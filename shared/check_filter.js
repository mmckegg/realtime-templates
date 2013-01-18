//TODO: add $present
//TODO: add $string
//TODO: add $number
//TODO: add $boolean
//TODO: add $match = 'regexp'
//TODO: add $max, $min
//TODO: add $blank
//TODO: add $null
//TODO: add $undefined


//TODO: Support multiple conditions (conditions handler maybe?)

module.exports = function(source, filter, options){
  // options: match (source, filter, any)
  // if filter, every filter permission must be satisfied (i.e. required fields)
  // if source, every source key must be specified in filter
  // if any, the keys don't matter, but if there is a match, they must pass
  
  options = options || {}
  options.match = options.match || 'filter'
  
  if (filter && filter.$present && source){
    return true
  } else if (filter && filter.$present === false && !source){
    return true
  } else if (filter === null){
    return true
  } else if (filter == null/*undefined test*/){
    return 'undefined'
  } else if (filter.$any){
    return true
  }
  
  if (source instanceof Object){
          
      if (filter instanceof Object){
        
        if (filter.$any){
          return true
        } else if (Array.isArray(source)) {
          
          // source is an array
          
          if (Array.isArray(filter.$contains)){
            
            return filter.$contains.every(function(value){
              return (~source.indexOf(value))
            })
            
          } else if (Array.isArray(filter.$excludes)){
            
            return filter.$excludes.every(function(value){
              return (!~source.indexOf(value))
            })
            
          } else if (Array.isArray(filter)) {
            
            // both source and filter are arrays, so ensure they match key by key
            return matchKeys(source, filter, options) && (filter.length == source.length)
            
          } else {
            
            // source is array but filter is a hash, so ensure that keys that do exist match filter
            return matchKeys(source, filter, options)
            
          }
          
        } else {          
          // both source and filter are standard hashes so match key by key
          return matchKeys(source, filter, options)
        }
      }

    
  } else {
    if (Array.isArray(filter.$only)) {
      return !!~filter.$only.indexOf(source)  
    } else if (Array.isArray(filter.$not)){
      return !~filter.$not.indexOf(source)
    } else {
      return source === filter
    }
  }
  
}

function matchKeys(source, filter, options){
  var result = false
  
  if (filter.$matchAny){
    return filter.$matchAny.some(function(innerFilter){
      var combinedFilter = mergeClone(filter, innerFilter)
      delete combinedFilter.$matchAny
      return matchKeys(source, combinedFilter, options)
    })
  } else {
    if (options.match === 'filter'){
      return Object.keys(filter).filter(isNotMeta).every(function(key){
        return module.exports(source[key], filter[key])
      })
    } else if (options.match === 'source'){
      return Object.keys(source).filter(isNotMeta).every(function(key){
        var res = module.exports(source[key], filter[key])
        if (filter.$optional && ~filter.$optional.indexOf(key)){
          return res
        } else if (res !== 'undefined'){
          return res
        }
      })
    } else {
      return Object.keys(source).filter(isNotMeta).every(function(key){
        return module.exports(source[key], filter[key])
      })
    }
  }

}

function isNotMeta(key){
  return (key.charAt(0) !== '$')
}

function mergeClone(){
  var result = {}
  for (var i=0;i<arguments.length;i++){
    var obj = arguments[i]
    if (obj){
      Object.keys(obj).forEach(function(key){
        result[key] = obj[key]
      })
    }
  }
  return result
}