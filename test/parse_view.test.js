var test = require('tap').test
var util = require('util')
var parseView = require('../shared/parse_view')

test("Parse standard elements", function(t){
  var view = "<div>Contents <strong>Some sub content</strong></div>"
  var expected = { 
    'main': {
      elements: [[ 
        'div',{},[ 'Contents ', [ 'strong', {}, [ 'Some sub content' ] ] ] 
      ]],
      sub: [],
      subBindings: [],
      referencedViews: [],
      bindings: [],
      _isView: true 
    }
  }
  t.deepEqual(parseView(view, 'main'), expected)
  t.end()
})


test("Parse standard elements", function(t){
  var view = "<div>Contents <span t:repeat='query'><span t:bind='.test:cat'/></span></div>"
  var expected = { 
    'main': {
      elements: [ 
        ['div',{},[ 'Contents ', {template: 'main:1'} ] ]
      ],
      sub: ['main:1'],
      referencedViews: [],
      bindings: [],
      subBindings: ['query'],
      _isView: true 
    },
    'main:1': {
      ref: 'main:1',
      query: 'query',
      elements: [ 
        [ 'span', {}, [ 
          [ 'span', { _bind: '.test:cat' } ] 
        ] ]
      ],
      sub: [],
      subBindings: [],
      bindings: ['.test:cat']
    }
  }

  console.error(util.inspect(parseView(view, 'main'), false, 10))

  t.deepEqual(parseView(view, 'main'), expected)
  t.end()
})

// TODO: More tests

test("Parse standard elements with inner view", function(t){
  var view = "<div>Contents <strong>Some sub content</strong> <placeholder t:view='inline_item'/></div>"
  //console.log(util.inspect(parseView(view), false, 10))
  
  var expected = {
    'main': {
      elements:
      [
        ['div',{},[
          'Contents ',['strong', {},['Some sub content']],' ',['placeholder',{
            _view: {name: 'inline_item'}
          },[]]]
        ]
      ],
      sub: [],
      referencedViews: ['inline_item'],
      bindings: [],
      subBindings: [],
      _isView: true
    }
  }
  t.deepEqual(parseView(view, 'main'), expected)
  t.end()
})