var EventEmitter = require('events').EventEmitter
  , generateNodes = require('./generate_nodes')
  , renderTemplate = require('../shared/render_template')
  , refreshDom = require('./refresh_dom')
  , walkDom = require('./walk_dom')
  , checkNodePosition = require('./check_node_position')

module.exports = function(view, datasource, options){
  // options: rootElement, formatters, behaviors
  
  var binder = new EventEmitter()
  binder.datasource = datasource
  binder.rootElement = options && options.rootElement || document
  binder.view = view 
  binder.formatters = options.formatters
  binder.behaviors = options.behaviors || {}
  
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
  
  setUpBindings(binder)


  function removeSourceElements(x){
    if (x.item.$elements){
      var itemsToRemove = x.item.$elements.filter(function(element){
        return element.source === x.item
      })
      if (itemsToRemove.length > 0){
        refreshNodes(x.collection.$elements)
        itemsToRemove.forEach(remove)
      }
    }
  }
  
  function checkNodeCollection(object, changeInfo){
    if (changeInfo.originalCollection && object.$elements){
      
      var unhandledPlaceholders = (changeInfo.collection.$placeholderElements || []).concat()
      
      object.$elements.forEach(function(element){
        if (element.source === object && element.collection === changeInfo.originalCollection){
          
          unbind(element)
                              
          if (!changeInfo.originalCollection.$placeholderElements.some(function(placeholder){
            
            // remove nodes in wrong location
            if (element.template === placeholder.template && element.parentNode === placeholder.parentNode){
              remove(element)
              console.log("Removed element", placeholder, element)
              return true
            }
            
          })) {
            
            // rebind nodes that have already been moved to correct location
            bindNode(element, object, changeInfo.collection, element.template, element.view, binder)
            
            // remove the elements placeholder from unhandled
            unhandledPlaceholders.some(function(placeholder, i){
              if (element.template === placeholder.template && element.parentNode === placeholder.parentNode){
                unhandledPlaceholders.splice(i, 1)
                console.log("Object already existing in destination collection. Moved manually", placeholder, element)
                return true
              }
            })
          }  
        }
      })
      
      unhandledPlaceholders.forEach(function(placeholder, pi){
        // append elements to correct locations
        appendObjectToPlaceholder(object, changeInfo.collection, placeholder)
        console.log("Generated new element", placeholder)
      })
      
    }
  }
  
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
  
  function appendObjectToPlaceholder(object, collection, placeholder){
    var i = collection.indexOf(object)

    var elements = renderTemplate(placeholder.template, object, {
      parent: placeholder.parentObject,
      datasource: binder.datasource, 
      formatters: binder.formatters, 
      view: binder.view, 
      ti: (placeholder.viewName || '') + ':' + placeholder.template.id + ':' + i,
      includeBindingMetadata: true
    })

    function behaviorHandler(n){
      bindBehavior(n, object, binder)
    }
    
    var appendedTemplateNodes = []
    
    generateNodes(elements, {behaviorHandler: behaviorHandler, templateHandler: function(entity, element){
      bindTemplatePlaceholder(entity, element, binder)
      appendedTemplateNodes.push(element)
    }}).forEach(function(node){
      appendNode(node, placeholder)
      bindNode(node, object, collection, placeholder.template, placeholder.view, binder)
    })
    
    appendedTemplateNodes.forEach(function(element){
      element.source.forEach(function(item){
        append({collection: element.source, item: item})
      })
    })
  }
  
  function append(toAppend){
    var collection = toAppend.collection
    var object = toAppend.item
    
    if (collection.$placeholderElements){    
      collection.$placeholderElements.forEach(function(placeholder){
        appendObjectToPlaceholder(object, collection, placeholder)
      })
    }
  }
  
  function appendNode(node, placeholder){
    if (placeholder.parentNode){
      placeholder.parentNode.insertBefore(node, placeholder)
      binder.emit('append', node)
    }
  }
  
  function refreshNodes(nodes, options){
    // options: ignoreAppendFor
    options = options || {}
    var appendedTemplateNodes = []
    
    if (nodes){
      nodes.forEach(function(node){
        if (node.template){

          var object = node.source
          if (object.$isProxy){
            // handle element sources that are strings/numbers rather than objects
            object = object.value
          }

          var newElements = renderTemplate(node.template, object, {
            datasource: binder.datasource, 
            parent: node.parentObject,
            formatters: binder.formatters, 
            view: binder.view,
            ti: node.getAttribute('data-ti'),
            includeBindingMetadata: true
          })


          refreshDom(node, newElements, {
            isEmbedded: !node.template._isView,
            behaviorHandler: function(n){
              bindBehavior(n, object, binder)
            },
            templateHandler: function(entity, element, appended){
              bindTemplatePlaceholder(entity, element, binder)
              if (appended){
                appendedTemplateNodes.push(element)
              }
            },
            removeHandler: function(element){
              unbind(element, binder)
            }
          })
        }
      })
    }
    
    appendedTemplateNodes.forEach(function(element){
      element.source.forEach(function(item){
        if (!options.ignoreAppendFor || !options.ignoreAppendFor.some(function(x){
          return x.collection === element.source && x.item === item
        })){
          append({collection: element.source, item: item})
        }
      })
    })
  }
  return binder
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

function bindTemplatePlaceholder(entity, element, binder){
  var currentView = binder.view.views[entity.template[0]] || binder.view
  var template = currentView.templates[entity.template[1]]
  var source = binder.datasource.get(template.query, entity._context, {force: []})
  
  element.parentObject = entity._context
  
  addBindingMetadata({
    element: element, 
    item: source,
    template: template,
    view: currentView,
    viewName: entity.template[0],
    isSource: true
  })
}

function setUpBindings(binder){
  
  // bind root node to context  
  bindNode(binder.rootElement, binder.datasource.data, null, binder.view, binder.view, binder)
  
  
  walkDom(binder.rootElement, function(node, state){
    if (isTemplate(node)){
      // find the template and view
      var ti = node.getAttribute('data-ti').split(':')
      var currentView = ti[0] && binder.view.views[ti[0]] || binder.view
      var currentTemplate = currentView
      if (ti[1]){
        currentTemplate = currentView.templates[ti[1]]
      }

      // get the source, and force it if it doesn't exit
      var collection = binder.datasource.query(currentTemplate.query, state.get('source'), {force: []}).value 
      var currentSource = collection[parseInt(ti[2], 10)]
      
      node.parentObject = state.get('source')
      
      if (currentSource){
        bindNode(node, currentSource, collection, currentTemplate, currentView, binder)
      }
      
      state.set('source', currentSource)
      
    } else if (isPlaceholder(node)){
      // get the template then use query to find the source using the current source as context
      var data = node.data.split(':')
      
      var view = data[0] && binder.view.views[data[0]] || binder.view
      var template = data[1] && view.templates[data[1]] || view
      
      var source = binder.datasource.query(template.query, state.get('source'), {force: []}).value 
      
      addBindingMetadata({
        element: node, 
        item: source,
        template: template,
        view: view,
        viewName: data[0],
        isSource: true
      })
    }
    
    // if has behavior, initialize
    if (node.nodeType === 1){
      bindBehavior(node, state.get('source'), binder)
    }
    
  })

}

function bindBehavior(node, source, binder){
  var behaviorName = node.getAttribute('data-behavior')
  if (behaviorName && binder.behaviors[behaviorName]){
    binder.behaviors[behaviorName](node, {object: source, datasource: binder.datasource})
  }
}

function unbind(node, binder){
  if (node.nodeType === 1){
    if (node.source && node.source.$elements){
      var index = node.source.$elements.indexOf(node)
      if (~index){
        node.source.$elements.splice(index, 1)
      }
    }
    if (node.collection && node.collection.$elements){
      var index = node.collection.$elements.indexOf(node)
      if (~index){
        node.collection.$elements.splice(index, 1)
      }
    }
    for (var i=0;i<node.childNodes.length;i++){
      unbind(node.childNodes[i], binder)
    }
  } else if (node.nodeType === 8){
    if (node.source && node.source.$placeholderElements){
      var index = node.source.$placeholderElements.indexOf(node)
      if (~index){
        node.source.$placeholderElements.splice(index, 1)
      }
    }
  }
}

function bindNode(node, source, collection, template, view, binder){
  
  addBindingMetadata({
    element: node, 
    item: source,
    collection: collection,
    template: template,
    view: view,
    isSource: true //two way binding
  })

  template.bindings.forEach(function(binding){
    // only bind if is not a local query
    
    if (~binding.indexOf(':') || binding.lastIndexOf('.') != 0){
      var result = binder.datasource.query(binding, source)
      result.references.forEach(function(reference){
        if (reference != source){
          addBindingMetadata({
            element: node,
            item: reference
          })
        }
      })
      
    }
  })
}

function isTemplate(node){
  return node.nodeType === 1 && node.getAttribute('data-ti')
}
function isPlaceholder(node){
  /// this should probably be a more rigorous test
  return node.nodeType === 8
}
function addBindingMetadata(options){
  // options: element, template, item, isSource
  
  var item = options.item || {}
    , element = options.element
    , template = options.template
    , view = options.view
    , collection = options.collection
    
  if (!(item instanceof Object)){
    // for handling element sources that are strings/numbers rather than objects
    item = getItemProxy(item, collection)
  }

  if (isPlaceholder(options.element)){
    // is a placeholder element
    if (!item.$placeholderElements) item.$placeholderElements = []
    addSet(item.$placeholderElements, element)
  } else {
    if (!item.$elements) item.$elements = []
    addSet(item.$elements, element)
  }
  
  if (options.isSource){
    if (Array.isArray(collection)){
      element.collection = collection
    }
    element.viewName = options.viewName
    element.source = item
    element.template = template
    element.view = view
  }
}

function getItemProxy(item, collection){
  var index = collection.indexOf(item)
  if (!collection.$proxy) collection.$proxy = []
  if (!collection.$proxy[index]) collection.$proxy[index] = {value: item, $isProxy: true}
  return collection.$proxy[index]
}

function addSet(a, item){
  if (a.indexOf(item) == -1){
    a.push(item)
  }
}
function addSetAll(a, items){
  items.forEach(addSet.bind(a))
}