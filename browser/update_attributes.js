var attributeProperties = {
    "tabindex": "tabIndex",
    "readonly": "readOnly",
    "for": "htmlFor",
    "class": "className",
    "maxlength": "maxLength",
    "cellspacing": "cellSpacing",
    "cellpadding": "cellPadding",
    "rowspan": "rowSpan",
    "colspan": "colSpan",
    "usemap": "useMap",
    "frameborder": "frameBorder",
    "contenteditable": "contentEditable"
}

module.exports = function(node, attributes){
  var removeAttributes = []
  for (var i = 0; i < node.attributes.length; i++) {
    var attribute = node.attributes[i];
    if (attribute.specified) {
      if (attributes[attribute.name] == null || attributes[attribute.name] === ''){
        removeAttributes.push(attribute.name)
      }
    }
  }
  Object.keys(attributes).forEach(function(k){
    if (k.charAt(0) !== '_'){
      var v = attributes[k]
      if (getAttribute(node, k) != v){
        setAttribute(node, k, v)
      }
    }
  })
  removeAttributes.forEach(function(k){
    removeAttribute(node, k)
  })
}

function getAttribute(element, key){
  var directAttribute = attributeProperties[key.toLowerCase()]
  if (directAttribute){
    return element[directAttribute]
  } else {
    element.getAttribute(key)
  }
}

function setAttribute(element, key, value){
  if (key === 'style'){
    element.style.cssText = value
  } else {
    var directAttribute = attributeProperties[key.toLowerCase()]
    if (directAttribute){
      element[directAttribute] = value
    } else {
      element.setAttribute(key, value)
    }
  }
}

function removeAttribute(element, key){
  if (key === 'style'){
    element.style.cssText = ''
  } else {
    var directAttribute = attributeProperties[key.toLowerCase()]
    if (directAttribute){
      element[directAttribute] = ''
    } else {
      element.removeAttribute(key)
    }
  }
}