var checkFilter = require('./check_filter')
module.exports = function(template, context, options){
  // options: datasource, formatters, view, entityHandler
  var viewRefStack = []
  var views = options.view.views
  var currentViewRef = null
  var result = []
  var formatters = options.formatters || {}
  var datasource = options && options.datasource || {}
  var parent = options && options.parent
  
  var bindingOptions = {datasource: datasource, context: context, formatters: formatters, parent: parent}
  
  template.elements.forEach(function(x, i){
    var meta = {}
    if (options.includeBindingMetadata){
      meta['data-tx'] = i
      if (options.ti){
        meta['data-ti'] = options.ti
      }
    }
    renderElement(x, result, meta) // options.includeBindingMetadata && {'data-tx': i, 'data-ti': options.ti} || {})
  })
    
  function pushViewRef(viewRef){
    viewRefStack.push(currentViewRef)
    currentViewRef = viewRef
  }
  function popViewRef(){
    var oldViewRef = currentViewRef
    currentViewRef = viewRefStack.pop()
    return oldViewRef
  }
  
  function renderElement(element, elements, extraAttributes){
    extraAttributes = extraAttributes || {}
    
    if (Array.isArray(element)){
      
      var attributes = element[1]
        , subElements = element[2] || []
      
      // if it has filters, make sure they all pass
      if (!attributes._filters || queryFilter(attributes._filters, bindingOptions)){
        
        var newElement = [element[0], {}, []]
        bindAttributes(attributes, newElement, bindingOptions)

        // add any extra attributes
        Object.keys(extraAttributes).forEach(function(key){
          newElement[1][key] = extraAttributes[key]
        })
        
        if (attributes._bind){
          bindElement(element, newElement, bindingOptions)
        } else if (attributes._view){
          
          var view = views[attributes._view.name]
          if (view){
            pushViewRef(merge(attributes._view, {elements: subElements}))
            view.elements.forEach(function(x, i){
              renderElement(x, newElement[2], options.includeBindingMetadata && {'data-tx': i} || {})
            })
            popViewRef()
          }
          
        } else if (attributes._content){
          if (currentViewRef){
            var viewRef = currentViewRef
            pushViewRef(viewRefStack[viewRefStack.length-1]) // push previous view as this is where the elements are from
            viewRef.elements.forEach(function(x, i){
              renderElement(x, newElement[2], options.includeBindingMetadata && {'data-tx': i} || {})
            })
            popViewRef()
          }
        } else {
          // recursively render sub elements
          subElements.forEach(function(x, i){
            renderElement(x, newElement[2], options.includeBindingMetadata && {'data-tx': i} || {})
          })
        }
        
        
        if (newElement[0] === 't:placeholder'){ // placeholder elements don't render... just their insides
          appendPlaceholderElements(newElement, elements)
        } else {
          elements.push(newElement)
        }
        
      }
      
    } else if (element instanceof Object){ // if it is not an element, pass thru e.g. text elements and templates
      if (options.entityHandler){
        options.entityHandler(element, elements, {viewRef: currentViewRef, context: context, tx: extraAttributes['data-tx']})
      }
      if (element.template != null){
        elements.push({template: [(currentViewRef && currentViewRef.name || ''), element.template], _context: context})
      } else {
        elements.push(merge(element, {_context: context, _tx: extraAttributes['data-tx']}))
      }
    } else {
      // text node
      if (!appendText(element, elements)){
        elements.push({text: element, _context: context, _tx: extraAttributes['data-tx']})
      }
      
    }
    
  }
  
  return result
}

function appendText(text, elements){
  var lastElement = elements[elements.length-1]
  if (lastElement && lastElement.text){
    // merge with last textnode if a textnode and compress whitespace.
    if (text !== ' ' || lastElement.text.slice(-1) !== ' '){
      lastElement.text += text
    }
    return true
  }
}

function appendPlaceholderElements(placeholder, elements){
  placeholder[2].forEach(function(element){
    if (Array.isArray(element)){
      if (placeholder[1]['data-tx'] != null && element[1]['data-tx'] != null){
        element[1]['data-tx'] = placeholder[1]['data-tx'] + '-' + element[1]['data-tx']
      }
    } else if (element instanceof Object){
      if (placeholder[1]['data-tx'] != null && element._tx != null){
        element._tx = placeholder[1]['data-tx'] + '-' + element._tx
      }
    }

    if (!element.text || !appendText(element.text, elements)){
      // check to make sure not a text double up
      elements.push(element)
    }
  })
}

function queryFilter(filter, options){
  var object = {}
  Object.keys(filter).forEach(function(key){
    if (key.lastIndexOf('.') === 0 && key.indexOf(':') === -1){
      object[key] = context[key.slice(1)] // optimisation ... if standard key, skip the query
    } else {      
      object[key] = options.datasource.get(key, options.context, {parent: options.parent}) // or else query to get result
    }
  })
  return checkFilter(object, filter)
}

function bindAttributes(attributes, destination, options){
  //TODO: handle bound attributes
  
  Object.keys(attributes).forEach(function(key){
    if (key.charAt(0) !== '_'){
      destination[1][key] = attributes[key]
    }
  })
  
  attributes._bindAttributes && Object.keys(attributes._bindAttributes).forEach(function(key){
    var value = options.datasource.get(attributes._bindAttributes[key], options.context, {parent: options.parent})
    if (value != null){
      destination[1][key] = value.toString()
    }
  })
  
}

function assignTx(elements){
  elements.forEach(function(element, i){
    if (typeof element === 'string'){
      element = elements[i] = {text: element}
    }
    if (Array.isArray(element)){
      element[1]['data-tx'] = i
      assignTx(element[2])
    } else if (element instanceof Object) {
      element._tx = i
    }
  })
}

function bindElement(templateElement, destination, options){
  var attributes = templateElement[1]
  var value = options.datasource.get(attributes._bind, options.context, {parent: options.parent})
  if (attributes._format && options.formatters[attributes._format]){ // use a formatter if specified
    var res = options.formatters[attributes._format](value)
    if (res){
      assignTx(res)
      res.forEach(function(element){
        destination[2].push(element)
      })
    }
  } else {
    // straight text display
    destination[2].push({text: value, _tx: 0})
  }
}

function merge(a,b){
  
  if (!a){
    return b || {}
  } else if (!b){
    return a || {}
  }
  
  var result = {}
  Object.keys(a).forEach(function(k){
    result[k] = a[k]
  })
  Object.keys(b).forEach(function(k){
    result[k] = b[k]
  })
  return result
}