module.exports = function(object, changeInfo){
  if (changeInfo.before){
    // check to see if should insert at end
    if (changeInfo.before === 'end'){
      return insertBefore(object, changeInfo.collection.$placeholderElements)
    } else {
      return insertBefore(object, changeInfo.before.$elements)
    }
  }
  
  if (changeInfo.after){
    // check to see if should insert at start
    if (changeInfo.after === 'start'){
      return insertBefore(object, changeInfo.collection[0].$elements)
    } else {
      return insertAfter(object, changeInfo.after.$elements)
    }
  }
}

function insertBefore(object, whereToInsert){
  if (whereToInsert && object && object.$elements){
    object.$elements.forEach(function(element){
      whereToInsert.some(function(beforeElement){
        if (element.template === beforeElement.template && element.parentNode === beforeElement.parentNode){
          if (element.nextSibling !== beforeElement){
            beforeElement.parentNode.insertBefore(element, beforeElement)
            return true
          }
        }
      })
    })
  }
}

function insertAfter(object, whereToInsert){
  if (whereToInsert && object && object.$elements){
    object.$elements.forEach(function(element){
      whereToInsert.some(function(afterElement){
        if (element.template === afterElement.template && element.parentNode === afterElement.parentNode){
          if (element.previousSibling !== afterElement){
            if (afterElement.nextSibling){
              afterElement.parentNode.insertBefore(element, afterElement.nextSibling)
            } else {
               afterElement.parentNode.appendChild(element)
            }
            return true
          }
        }
      })
    })
  }
}