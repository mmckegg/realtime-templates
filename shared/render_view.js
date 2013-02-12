var renderTemplate = require('./render_template')
  , getTemplateContextFor = require('./template_context')
  , refreshTemplateContext = getTemplateContextFor.refresh
  , mergeClone = require('./merge_clone')


module.exports = function(view, datasource, options){
  // options: formatters, includeBindingMetadata
  options = options || {}

  var templateContext = getTemplateContextFor(view.$root, datasource.data, {
    view: view,
    datasource: datasource, 
    formatters: options.formatters,
    includeBindingMetadata: options.includeBindingMetadata,
    entityHandler: entityHandler
  })
  
  var elements = renderTemplate(templateContext)
    
  if (options.includeBindingMetadata){
    elements.push(['script', {'type': 'application/json', id: 'realtimeBindingInfo'}, [JSON.stringify({data: datasource.data, matchers: datasource.matchers, view: view})]])
  }

  return elements
}



function entityHandler(entity, elements, parentContext){
  if (entity.template){
    var template = parentContext.view[entity.template]
    var collection = parentContext.queryValues[template.query]
    
    if (collection && collection.forEach){
      collection.forEach(function(item, i){
        var templateContext = getTemplateContextFor(entity.template, item, parentContext)
        templateContext.index = i
        renderTemplate(templateContext).forEach(function(element){
          elements.push(element) 
        })
      })
    }
  } else if (entity.view){
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

function getViewContextFor(viewName, parentContext){
  return mergeClone(parentContext, {
    template: parentContext.view[viewName]
  })
}

function mergeInto(a,b){
  
  var result = b
  if (a){
    Object.keys(a).forEach(function(k){
      result[k] = a[k]
    })
  }

  return result
}