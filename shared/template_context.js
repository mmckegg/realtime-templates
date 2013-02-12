var mergeClone = require('./merge_clone')

module.exports = function(templateName, object, options){
  //options: datasource, override, parent
  var context = {
    queryValues: {},

    view: options.view,
    formatters: options.formatters,
    includeBindingMetadata: options.includeBindingMetadata,
    entityHandler: options.entityHandler,
    contentElements: options.contentElements,
    useProxies: options.useProxies,
    datasource: options.datasource,
    behaviors: options.behaviors,

    override: options.override || {},

    template: options.view[templateName],
    parent: options.parent || options.source,
    source: object,

    references: [],
  }
  
  if (options.queryValues && context.template){
    context.collection = get(context.template.query, options) || null
  }

  if (context.useProxies){
    if (!(object instanceof Object)){
      context.bindingSource = getItemProxy(object, context.collection)
    } else {
      context.bindingSource = object
    }
  }

  if (context.template.contextAs){
    context.override = mergeClone(context.override)
    context.override[context.template.contextAs] = object
  }

  module.exports.refresh(context)

  return context
}

module.exports.refresh = function(templateContext){
  var template = templateContext.template
  var datasource = templateContext.datasource
  var object = templateContext.source

  var queries = template.bindings.concat()
  var subQueries = template.subBindings.concat()

  function appendSubQueries(viewName){
    var subView = templateContext.view[viewName]
    addSetAll(queries, subView.bindings)
    addSetAll(subQueries, subView.subBindings)
    subView.subViews.forEach(appendSubQueries)
  }


  template.subViews.forEach(appendSubQueries)

  templateContext.references.length = 0

  subQueries.forEach(function(query){
    var result = datasource.query(query, object, mergeClone(templateContext, {force: []}))
    templateContext.queryValues[query] = result.value
  })

  queries.forEach(function(query){
    var result = datasource.query(query, object, templateContext)
    addSetAll(templateContext.references, result.references)
    templateContext.queryValues[query] = result.value
  })
}

var get = module.exports.get = function(query, templateContext){
  if (query === '.'){
    return templateContext.source
  } else if (query.lastIndexOf('.') === 0 && !~query.indexOf(':') && !~query.indexOf('|')){
    return templateContext.source[query.slice(1)] // optimisation ... if standard key, skip the query
  } else {      
    return templateContext.queryValues[query]
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
  items.forEach(function(item){
    addSet(a, item)
  })
}