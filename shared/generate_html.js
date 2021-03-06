var mergeClone = require('./merge_clone')

var selfClosing = ['meta'
 , 'img'
 , 'link'
 , 'input'
 , 'area'
 , 'base'
 , 'col'
 , 'br'
 , 'hr']

var booleanAttributes = [
  'checked', 'disabled', 'contenteditable'
]


module.exports = function(elements, entityHandler){
  var result = ""
  elements.forEach(function(element){
    result += module.exports.generateElement(element, entityHandler)
  })
  
  return result
}

module.exports.generateElement = function(element, entityHandler){
  var result = ""
  
  if (Array.isArray(element)){
      // standard element
      if (isSelfClosing(element[0])){
        result += openTag(element[0], element[1], true)
      } else if (element[0] === 'script'){
        result += openTag(element[0], element[1])
        if (element[2]){
          element[2].forEach(function(e){
            if (typeof e === 'string'){
              result += e
            } else {
              result += module.exports.generateElement(e, entityHandler) // recursively render all elements
            }
          })
        }
        result += closeTag(element[0])
        
      } else {
        var renderedElements = ''
        var attributes = element[1]
        if (element[2]){
          element[2].forEach(function(e){
            if (e.parentAttributes){
              attributes = mergeClone(attributes, e.parentAttributes)
            } else {
              renderedElements += module.exports.generateElement(e, entityHandler) // recursively render all elements
            }
          })
        }
        result += openTag(element[0], attributes) + renderedElements + closeTag(element[0])
      }

  } else if (element instanceof Object){
    
    // entity e.g. template
    if (element.text){
      result += escapeHTML(element.text.toString())
    } if (element.comment) {
      result += '<!--' + escapeHTML(element.comment.toString()) + '-->'
    } else if (entityHandler){
      var x = entityHandler(element)
      if (x){
        result += x
      }
    }
    if (element.template){
      result += '<!--' + escapeHTML(element.template) + '-->'
    }
  } else {
    // text node
    if (element != null && element.toString){
      result += escapeHTML(element.toString())
    }
    
  }
  
  return result
}

function isSelfClosing(name){
  return selfClosing.indexOf(name) >= 0
}

function escapeAttribute(attribute){
  return attribute || attribute === 0 ? escapeHTML(attribute.toString().replace(/"/g, '&quot;')) : '';
}
function escapeHTML(s) {
  return s ? s.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

function openTag(name, attributes, selfClose){
  var result = '<' + name
  
  Object.keys(attributes).forEach(function(key){
    if (key.charAt !== '_'){
      if (~booleanAttributes.indexOf(key)){
        if (attributes[key]){
          result += ' ' + key
        }
      } else {
        result += (' ' + key + '="' + escapeAttribute(attributes[key]) + '"' )
      }
    }
  })
  
  if (selfClose){
    result += ' /'
  }
  return result + '>'
}

function closeTag(name){
  return '</' + name + '>'
}