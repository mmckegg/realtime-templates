module.exports = function(root, iterator){
  var stateStack = createStateStack()
  var currentNode = root.firstChild
  while (currentNode){
    
    stateStack.setNode(currentNode)
    iterator(currentNode, stateStack)
    
    if (currentNode.firstChild){
      // walk children
      currentNode = currentNode.firstChild
    } else {
      // check if nextSibling - if not walk up parents
      while (currentNode && !currentNode.nextSibling){
        if (currentNode !== root) {
          currentNode = currentNode.parentNode
          stateStack.popNode(currentNode)
        } else {
          currentNode = null
        }
      }
      currentNode = currentNode && currentNode.nextSibling
    }
    
  }
}

function createStateStack(rootNode){
  var currentNode = rootNode || null
  
  var stateStacks = {}
  var state = {}
  
  var stack = {
    set: function(key, value){
      if (state[key]){
        if (!stateStacks[key]){
          stateStacks[key] = []
        }
        stateStacks[key].push(state[key])
      }
      state[key] = {node: currentNode, value: value}
    },
    get: function(key){
      return state[key] && state[key].value || null
    },
    setNode: function(node){
      currentNode = node
    },
    popNode: function(node){
      Object.keys(state).forEach(function(key){
        var value = state[key]
        if (value && value.node === node){
          state[key] = stateStacks[key] && stateStacks[key].pop() || null
        }
      })
    }
  }
  return stack
}