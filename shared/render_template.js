var checkFilter = require('./check_filter')
module.exports = function(templateContext){
  // templateContext: source, template, datasource, formatters, view, entityHandler
  var viewRefStack = []
  var currentViewRef = null
  var result = []

  var template = templateContext.template
  var formatters = templateContext.formatters || {}

  // fallback if no query values supplied
  if (!templateContext.queryValues){
    templateContext.queryValues = {}
    template.bindings.forEach(function(query){
      templateContext.queryValues[query] = templateContext.datasource.get(query, context)
    })
  }

  function get(query){
    if (query === '.'){
      return templateContext.source
    } else if (query.lastIndexOf('.') === 0 && !~query.indexOf(':') && !~query.indexOf('|')){
      return templateContext.source[query.slice(1)] // optimisation ... if standard key, skip the query
    } else {      
      return templateContext.queryValues[query]
    }
  }

  function format(name, value){
    if (formatters[name]){
      return formatters[name](value, templateContext)
    } else {
      return []
    }
  }
  
  template.elements.forEach(function(x, i){
    var meta = {}
    if (templateContext.includeBindingMetadata){
      meta['data-tx'] = i
      if (templateContext.index != null){
        if (templateContext.template.ref == null){
          throw JSON.stringify(templateContext.template)
        }
        meta['data-ti'] = templateContext.template.ref + ':' + templateContext.index
      }
    }
    renderElement(x, result, meta) // options.includeBindingMetadata && {'data-tx': i, 'data-ti': options.ti} || {})
  })
  
  function renderElement(templateElement, elements, extraAttributes){
    extraAttributes = extraAttributes || {}
    
    if (Array.isArray(templateElement)){
      
      var attributes = templateElement[1]
        , subElements = templateElement[2] || []
      
      // if it has filters, make sure they all pass
      if (!attributes._filters || queryFilter(attributes._filters, get)){
        
        var newElement = [templateElement[0], {}, []]
        bindAttributes(attributes, newElement, get)

        // add any extra attributes
        Object.keys(extraAttributes).forEach(function(key){
          newElement[1][key] = extraAttributes[key]
        })
        
        if (attributes._bind){
          bindElement(templateElement, newElement, get, format)
        } else if (attributes._view){
          templateContext.entityHandler && templateContext.entityHandler({view: attributes._view, elements: subElements}, newElement[2], templateContext)
        } else if (attributes._content){
          if (templateContext.contentElements){
            templateContext.contentElements.forEach(function(x, i){
              renderElement(x, newElement[2], templateContext.includeBindingMetadata && {'data-tx': i} || {})
            })
          }

          templateContext.entityHandler && templateContext.entityHandler({viewContent: true}, elements, templateContext)
        } else {
          // recursively render sub elements
          subElements.forEach(function(x, i){
            renderElement(x, newElement[2], templateContext.includeBindingMetadata && {'data-tx': i} || {})
          })
        }
        
        
        if (newElement[0] === 't:placeholder'){ // placeholder elements don't render... just their insides
          appendPlaceholderElements(newElement, elements)
        } else {
          elements.push(newElement)
        }
        
      }
      
    } else if (templateElement instanceof Object){ // if it is not an element, pass thru e.g. text elements and templates
      if (templateContext.entityHandler){
        templateContext.entityHandler(templateElement, elements, templateContext)
      }
      if (templateElement.template != null){
        elements.push({template: templateElement.template, _context: templateContext.source})
      } else {
        elements.push(merge(templateElement, {_context: templateContext.source, _tx: extraAttributes['data-tx']}))
      }
    } else {
      // text node
      if (!appendText(templateElement, elements)){
        elements.push({text: templateElement, _context: templateContext.source, _tx: extraAttributes['data-tx']})
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
  elements.push({
    parentAttributes: placeholder[1]
  })
  
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

function queryFilter(filter, get){
  var object = {}
  Object.keys(filter).forEach(function(key){
    object[key] = get(key)
  })
  return checkFilter(object, filter)
}

function bindAttributes(attributes, destination, get){
  //TODO: handle bound attributes
  
  Object.keys(attributes).forEach(function(key){
    if (key.charAt(0) !== '_'){
      destination[1][key] = attributes[key]
    }
  })
  
  attributes._bindAttributes && Object.keys(attributes._bindAttributes).forEach(function(key){
    var value = get(attributes._bindAttributes[key])
    if (value != null){
      destination[1][key] = value
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

function bindElement(templateElement, destination, get, format){
  var attributes = templateElement[1]
  var value = get(attributes._bind)
  if (attributes._format){ // use a formatter if specified
    var res = format(attributes._format, value)
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