var EventEmitter = require('events').EventEmitter
  , generateNodes = require('./generate_nodes')
  , renderTemplate = require('../shared/render_template')
  , refreshDom = require('./refresh_dom')
  , walkDom = require('./walk_dom')
  , checkNodePosition = require('./check_node_position')
  , getTemplateContextFor = require('../shared/template_context')
  , refreshTemplateContext = getTemplateContextFor.refresh
  , getFromTemplateContext = getTemplateContextFor.get
  , mergeClone = require('../shared/merge_clone')

module.exports = function(view, datasource, options){
  // options: rootElement, formatters, behaviors
  
  var binder = new EventEmitter()
  binder.datasource = datasource
  binder.rootElement = options && options.rootElement || document
  binder.view = view 
  binder.formatters = options.formatters
  binder.behaviors = options.behaviors || {}
  
  // watch for changes
  datasource.on('change', function(object, changeInfo){
    if (changeInfo.action === 'append'){
      refreshNodes(changeInfo.collection.$elements)
      append({collection: changeInfo.collection, item: object})
      checkNodePosition(object, changeInfo)
    }
    if (changeInfo.action === 'update'){
      refreshNodes(changeInfo.collection.$elements)
      
      checkNodeCollection(object, changeInfo)
      checkNodePosition(object, changeInfo)
      
      refreshNodes(findElementsInObject(object), {ignoreAppendFor: changeInfo.addedItems})
      
      // add and remove sub template items
      changeInfo.removedItems && changeInfo.removedItems.forEach(removeSourceElements)
      changeInfo.addedItems && changeInfo.addedItems.forEach(append) 
    }
    if (changeInfo.action === 'remove'){
      removeSourceElements({collection: changeInfo.collection, item: object})
      refreshNodes(changeInfo.collection.$elements)
    }
  })
  
  // set up root template context
  var rootTemplateContext = getTemplateContextFor(binder.view.$root, binder.datasource.data, {
    datasource: binder.datasource, 
    formatters: binder.formatters, 
    behaviors: binder.behaviors,
    view: binder.view, 
    useProxies: true,
    entityHandler: viewEntityHandler,
    includeBindingMetadata: true
  })

  bindTemplateNode(binder.rootElement, rootTemplateContext)

  // walk DOM and bind elements
  walkDom(binder.rootElement, function(node, templateContext){
    if (isTemplate(node)){
      templateContext = buildTemplateContextForNode(node, templateContext)
      bindTemplateNode(node, templateContext)
      bindBehavior(node, templateContext)
      return templateContext
    } else if (isPlaceholder(node)){
      bindTemplatePlaceholder(node, templateContext)
    } else if (node.nodeType === 1){
      bindBehavior(node, templateContext)
    }
  }, rootTemplateContext)


  function remove(element){
    // hooks for animation
    element.removeAttribute('data-tx')
    element.removeAttribute('data-ti')
    
    var waiting = false
    var timer = null
    function doIt(){
      element.parentNode.removeChild(element)
      binder.emit('remove', element)
    }
    function wait(seconds){
      clearTimeout(timer)
      waiting = true
      timer = setTimeout(doIt, seconds)
    }
    binder.emit('beforeRemove', element, wait)
    if (!waiting) doIt()
  }
  
  function appendObjectToPlaceholder(object, placeholder){

    var template = placeholder.placeholderContext.template

    var templateContext = getTemplateContextFor(template.ref, object, parentTemplateContextFor(placeholder))
    templateContext.index = templateContext.collection.indexOf(object)

    // render interim elements
    var elements = renderTemplate(templateContext)

    function behaviorHandler(n){
      bindBehavior(n, templateContext)
    }
    
    var appendedTemplateNodes = []
    var newNodes = []
    
    // generate dom nodes from interim elements
    generateNodes(elements, {behaviorHandler: behaviorHandler, templateHandler: function(entity, element){
      bindTemplatePlaceholder(element, templateContext)
      appendedTemplateNodes.push(element)
    }}).forEach(function(node){
      newNodes.push(node)
      appendNode(node, placeholder)
      bindTemplateNode(node, templateContext)
    })
    
    appendedTemplateNodes.forEach(function(node){
      node.placeholderContext.source.forEach && node.placeholderContext.source.forEach(function(item){
        appendObjectToPlaceholder(item, node)
      })
    })

    return newNodes
  }
  
  function append(toAppend){
    var collection = toAppend.collection
    var object = toAppend.item
    
    if (collection.$placeholderElements){    
      collection.$placeholderElements.forEach(function(placeholder){
        appendObjectToPlaceholder(object, placeholder).forEach(function(node){
          // emit new nodes
          binder.emit('append', node)
        })
      })
    }
  }
  
  function appendNode(node, placeholder){
    if (placeholder.parentNode){
      placeholder.parentNode.insertBefore(node, placeholder)
    }
  }
  
  function refreshNodes(nodes, options){
    // options: ignoreAppendFor
    options = options || {}
    var appendedTemplateNodes = []
    
    if (nodes){
      nodes.forEach(function(node){
        var templateContext = node.templateContext

        if (templateContext){
          refreshTemplateContext(templateContext)
          if (templateContext.index != null){
            templateContext.index = templateContext.collection.indexOf(templateContext.source)
          }

          bindQueryReferences(node, templateContext.references)

          var newElements = renderTemplate(templateContext)

          refreshDom(node, newElements, {
            isEmbedded: !templateContext.template._isView,
            behaviorHandler: function(n){
              bindBehavior(n, templateContext)
            },
            templateHandler: function(entity, element, appended){
              bindTemplatePlaceholder(element, templateContext)

              if (appended){
                appendedTemplateNodes.push(element)
              }
            },
            removeHandler: function(element){
              unbind(element)
            },
            referenceHandler: bindQueryReferences
          })
        }
      })
    }
    
    appendedTemplateNodes.forEach(function(element){
      var collection = element.placeholderContext.source
      collection.forEach(function(item){
        if (!options.ignoreAppendFor || !options.ignoreAppendFor.some(function(x){
          return x.collection === collection && x.item === item
        })){
          append({collection: collection, item: item})
        }
      })
    })
  }

  function checkNodeCollection(object, changeInfo){
    //TODO: This needs some serious tidy up
    if (changeInfo.originalCollection && object.$elements){
      
      var unhandledPlaceholders = (changeInfo.collection.$placeholderElements || []).concat()

      object.$elements.forEach(function(element){
        if (element.templateContext){
          var templateContext = element.templateContext

          if (templateContext.source === object && templateContext.collection === changeInfo.originalCollection){
          
          unbind(element)
                              
          if (!changeInfo.originalCollection.$placeholderElements.some(function(node){

            // remove nodes in wrong location
            if (templateContext.template === node.placeholderContext.template && element.parentNode === node.parentNode){
              remove(element)
              return true
            }

          })) {
            
            // rebind nodes that have already been moved to correct location
            refreshTemplateContext(element.templateContext)
            bindTemplateNode(element, element.templateContext)
            
            // remove the elements placeholder from unhandled
            unhandledPlaceholders.some(function(node, i){
              if (element.templateContext.template === node.placeholderContext.template && element.parentNode === node.parentNode){
                unhandledPlaceholders.splice(i, 1)
                return true
              }
            })
          }  
        }
        }
        
      })
      
      unhandledPlaceholders.forEach(function(placeholder, pi){
        // append elements to correct locations
        appendObjectToPlaceholder(object, placeholder)
      })
      
    }
  }
  
  function removeSourceElements(options){
    //options: item, collection
    if (options.item && options.item.$elements){
      var itemsToRemove = options.item.$elements.filter(function(element){
        return element.templateContext.source === options.item && options.collection === element.templateContext.collection
      })
      if (itemsToRemove.length > 0){
        itemsToRemove.forEach(remove)
      }
    }
  }

  
  return binder
}

function viewEntityHandler(entity, elements, parentContext){
  if (entity.view){
    var template = parentContext.view[entity.view]

    var templateContext = mergeClone(parentContext, {
      template: parentContext.view[entity.view],
      contentElements: entity.viewContent,
      index: null
    })

    renderTemplate(templateContext).forEach(function(element){
      elements.push(element)
    })
  }
}

function findElementsInObject(object){
  var elements = []
  
  function findElements(obj){
    if (obj instanceof Object){
      if (obj.$elements){
        obj.$elements.forEach(function(e){
          addSet(elements, e)
        })
      }
      if (Array.isArray(obj)){
        obj.forEach(findElements)
        if (obj.$proxy){
          obj.$proxy.forEach(findElements)
        }
      } else {
        Object.keys(obj).forEach(function(key){
          if (key.charAt(0) !== '$'){
            findElements(obj[key])
          }
        })
      }
    }
  }
  
  findElements(object)
  return elements
}

function bindTemplatePlaceholder(node, templateContext){
  var viewName = node.data

  var template = templateContext.view[viewName]
  var source = getFromTemplateContext(template.query, templateContext)

  if (node.placeholderContext){
    if (node.placeholderContext.source !== source){
      unbind(node)
      //TODO: also should force all sub items to refresh at this point
    } else {
      return
    }
  }

  node.placeholderContext = {
    source: source,
    template: template
  }

  // link collections back to this placeholder
  if (!source.$placeholderElements) source.$placeholderElements = []
  addSet(source.$placeholderElements, node)
}


function bindTemplateNode(node, templateContext){ //(node, source, collection, template, view, binder){
  var source = templateContext.bindingSource

  if (!source.$elements) source.$elements = []
  addSet(source.$elements, node)

  node.templateContext = templateContext
  bindQueryReferences(node, templateContext.references)
}


function bindQueryReferences(node, references){
  references.forEach(function(reference){
    if (!reference.$elements) reference.$elements = []
    addSet(reference.$elements, node) 
  })
}

function bindBehavior(node, templateContext){
  var behaviorNames = node.getAttribute('data-behavior')
  if (behaviorNames){
    behaviorNames.split(' ').forEach(function(behaviorName){
      if (templateContext.behaviors[behaviorName]){
        var behaviorCallback = templateContext.behaviors[behaviorName](node, templateContext)
        if (behaviorCallback){
          node.behaviors = node.behaviors || []
          node.behaviors.push(behaviorCallback)
        }
      }
    })
  }
}

function unbind(node){
  if (node.nodeType === 1){
    if (node.templateContext){
      var sourceElements = node.templateContext.collection.$elements
      var collectionElements = node.templateContext.source.$elements

      if (sourceElements){
        var index = sourceElements.indexOf(node)
        if (~index){
          sourceElements.splice(index, 1)
        }
      }
      if (collectionElements){
        var index = collectionElements.indexOf(node)
        if (~index){
          collectionElements.splice(index, 1)
        }
      }
      for (var i=0;i<node.childNodes.length;i++){
        unbind(node.childNodes[i])
      }
    }

  } else if (node.nodeType === 8){
    if (node.placeholderContext){
      var placeholderElements = node.placeholderContext.source.$placeholderElements
      if (placeholderElements){
        var index = placeholderElements.indexOf(node)
        if (~index){
          placeholderElements.splice(index, 1)
        }
      }
    }
  }
}

function buildTemplateContextForNode(node, parentTemplateContext){
  // find the template and view
  var ti = node.getAttribute('data-ti')
  var splitPoint = ti.lastIndexOf(':')

  var viewName = ti.slice(0, splitPoint)
  var index = parseInt(ti.slice(splitPoint + 1), 10)

  var template = parentTemplateContext.view[viewName]
  var collection = getFromTemplateContext(template.query, parentTemplateContext)
  var currentSource = collection[index]

  var context = getTemplateContextFor(template.ref, currentSource, parentTemplateContext)
  context.index = index
  
  return context
}

function isTemplate(node){
  return node.nodeType === 1 && node.getAttribute('data-ti')
}
function isPlaceholder(node){
  /// this should probably be a more rigorous test
  return node.nodeType === 8
}

function parentTemplateContextFor(node){
  var currentNode = node
  while (currentNode){
    currentNode = currentNode.parentNode
    if (currentNode && currentNode.templateContext){
      return currentNode.templateContext
    }
  }
}


function addSet(a, item){
  if (a.indexOf(item) == -1){
    a.push(item)
  }
}
function addSetAll(a, items){
  items.forEach(addSet.bind(a))
}