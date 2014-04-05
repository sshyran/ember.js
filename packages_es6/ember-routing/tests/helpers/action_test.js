import Ember from 'ember-metal/core'; // A, FEATURES, assert, TESTING_DEPRECATION
import {set} from "ember-metal/property_set";
import run from "ember-metal/run_loop";
import EventDispatcher from "ember-views/system/event_dispatcher";

import EmberObject from "ember-runtime/system/object";
import {Controller as EmberController} from "ember-runtime/controllers/controller";
import EmberObjectController from "ember-runtime/controllers/object_controller";
import EmberArrayController from "ember-runtime/controllers/array_controller";

import EmberHandlebars from "ember-handlebars";
import {View as EmberView} from "ember-views/views/view";
import EmberComponent from "ember-views/views/component";
import jQuery from "ember-views/system/jquery";

import "ember-routing/helpers/shared";
import {ActionHelper, actionHelper} from "ember-routing/helpers/action";

var dispatcher, view, originalActionHelper,
    originalRegisterAction = ActionHelper.registerAction;

var appendView = function() {
  run(function() { view.appendTo('#qunit-fixture'); });
};

module("Ember.Handlebars - action helper", {
  setup: function() {
    originalActionHelper = EmberHandlebars.helpers['action'];
    EmberHandlebars.registerHelper('action', actionHelper);

    dispatcher = EventDispatcher.create();
    dispatcher.setup();
  },

  teardown: function() {
    run(function() {
      dispatcher.destroy();
      if (view) { view.destroy(); }
    });

    delete EmberHandlebars.helpers['action'];
    EmberHandlebars.helpers['action'] = originalActionHelper;

    Ember.TESTING_DEPRECATION = false;
  }
});

test("should output a data attribute with a guid", function() {
  view = EmberView.create({
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  appendView();

  ok(view.$('a').attr('data-ember-action').match(/\d+/), "A data-ember-action attribute with a guid was added");
});

test("should by default register a click event", function() {
  var registeredEventName;

  ActionHelper.registerAction = function(actionName, options) {
    registeredEventName = options.eventName;
  };

  view = EmberView.create({
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  appendView();

  equal(registeredEventName, 'click', "The click event was properly registered");

  ActionHelper.registerAction = originalRegisterAction;
});

test("should allow alternative events to be handled", function() {
  var registeredEventName;

  ActionHelper.registerAction = function(actionName, options) {
    registeredEventName = options.eventName;
  };

  view = EmberView.create({
    template: EmberHandlebars.compile('<a href="#" {{action "edit" on="mouseUp"}}>edit</a>')
  });

  appendView();

  equal(registeredEventName, 'mouseUp', "The alternative mouseUp event was properly registered");

  ActionHelper.registerAction = originalRegisterAction;
});

test("should by default target the view's controller", function() {
  var registeredTarget, controller = {};

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target;
  };

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>edit</a>')
  });

  appendView();

  equal(registeredTarget.root, controller, "The controller was registered as the target");

  ActionHelper.registerAction = originalRegisterAction;
});

test("Inside a yield, the target points at the original target", function() {
  var controller = {}, watted = false;

  var component = EmberComponent.extend({
    boundText: "inner",
    truthy: true,
    obj: {},
    layout: EmberHandlebars.compile("<p>{{boundText}}</p><p>{{#if truthy}}{{#with obj}}{{yield}}{{/with}}{{/if}}</p>")
  });

  view = EmberView.create({
    controller: {
      boundText: "outer",
      truthy: true,
      wat: function() {
        watted = true;
      },
      obj: {
        component: component,
        truthy: true,
        boundText: 'insideWith'
      }
    },
    template: EmberHandlebars.compile('{{#with obj}}{{#if truthy}}{{#view component}}{{#if truthy}}<p {{action "wat"}} class="wat">{{boundText}}</p>{{/if}}{{/view}}{{/if}}{{/with}}')
  });

  appendView();

  run(function() {
    view.$(".wat").click();
  });

  equal(watted, true, "The action was called on the right context");
});

test("should target the current controller inside an {{each}} loop", function() {
  var registeredTarget;

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target;
  };

  var itemController = EmberObjectController.create();

  var ArrayController = EmberArrayController.extend({
    itemController: 'stub',
    controllerAt: function(idx, object) {
      return itemController;
    }
  });

  var controller = ArrayController.create({
    model: Ember.A([1])
  });

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('{{#each controller}}{{action "editTodo"}}{{/each}}')
  });

  appendView();

  equal(registeredTarget.root, itemController, "the item controller is the target of action");

  ActionHelper.registerAction = originalRegisterAction;
});

test("should allow a target to be specified", function() {
  var registeredTarget;

  ActionHelper.registerAction = function(actionName, options) {
    registeredTarget = options.target;
  };

  var anotherTarget = EmberView.create();

  view = EmberView.create({
    controller: {},
    template: EmberHandlebars.compile('<a href="#" {{action "edit" target="view.anotherTarget"}}>edit</a>'),
    anotherTarget: anotherTarget
  });

  appendView();

  equal(registeredTarget.options.data.keywords.view, view, "The specified target was registered");
  equal(registeredTarget.target, 'view.anotherTarget', "The specified target was registered");

  ActionHelper.registerAction = originalRegisterAction;

  run(function() {
    anotherTarget.destroy();
  });
});

test("should lazily evaluate the target", function() {
  var firstEdit = 0, secondEdit = 0;

  var controller = {};
  var first = {
    edit: function() {
      firstEdit++;
    }
  };

  var second = {
    edit: function() {
      secondEdit++;
    }
  };

  controller.theTarget = first;

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit" target="theTarget"}}>edit</a>')
  });

  appendView();

  run(function() {
    jQuery('a').trigger('click');
  });

  equal(firstEdit, 1);

  set(controller, 'theTarget', second);

  run(function() {
    jQuery('a').trigger('click');
  });

  equal(firstEdit, 1);
  equal(secondEdit, 1);
});

test("should register an event handler", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>click me</a>')
  });

  appendView();

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionHelper.registeredActions[actionId], "The action was registered");

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("handles whitelisted modifier keys", function() {
  var eventHandlerWasCalled = false, shortcutHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { eventHandlerWasCalled = true; },
      shortcut: function() { shortcutHandlerWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit" allowedKeys="alt"}}>click me</a> <div {{action "shortcut" allowedKeys="any"}}>click me too</div>')
  });

  appendView();

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionHelper.registeredActions[actionId], "The action was registered");

  var e = jQuery.Event('click');
  e.altKey = true;
  view.$('a').trigger(e);

  ok(eventHandlerWasCalled, "The event handler was called");

  e = jQuery.Event('click');
  e.ctrlKey = true;
  view.$('div').trigger(e);

  ok(shortcutHandlerWasCalled, "The \"any\" shortcut's event handler was called");
});

test("should be able to use action more than once for the same event within a view", function() {
  var editWasCalled = false,
      deleteWasCalled = false,
      originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { editWasCalled = true; },
      "delete": function() { deleteWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile(
      '<a id="edit" href="#" {{action "edit"}}>edit</a><a id="delete" href="#" {{action "delete"}}>delete</a>'
    ),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  appendView();

  view.$('#edit').trigger('click');

  equal(editWasCalled, true, "The edit action was called");
  equal(deleteWasCalled, false, "The delete action was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$('#delete').trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, true, "The delete action was called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$().trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, false, "The delete action was not called");
});

test("the event should not bubble if `bubbles=false` is passed", function() {
  var editWasCalled = false,
      deleteWasCalled = false,
      originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: {
      edit: function() { editWasCalled = true; },
      "delete": function() { deleteWasCalled = true; }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile(
      '<a id="edit" href="#" {{action "edit" bubbles=false}}>edit</a><a id="delete" href="#" {{action "delete" bubbles=false}}>delete</a>'
    ),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  appendView();

  view.$('#edit').trigger('click');

  equal(editWasCalled, true, "The edit action was called");
  equal(deleteWasCalled, false, "The delete action was not called");
  equal(originalEventHandlerWasCalled, false, "The original event handler was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$('#delete').trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, true, "The delete action was called");
  equal(originalEventHandlerWasCalled, false, "The original event handler was not called");

  editWasCalled = deleteWasCalled = originalEventHandlerWasCalled = false;

  view.$().trigger('click');

  equal(editWasCalled, false, "The edit action was not called");
  equal(deleteWasCalled, false, "The delete action was not called");
  equal(originalEventHandlerWasCalled, true, "The original event handler was called");
});

test("should work properly in an #each block", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    items: Ember.A([1, 2, 3, 4]),
    template: EmberHandlebars.compile('{{#each view.items}}<a href="#" {{action "edit"}}>click me</a>{{/each}}')
  });

  appendView();

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("should work properly in a #with block", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    something: {ohai: 'there'},
    template: EmberHandlebars.compile('{{#with view.something}}<a href="#" {{action "edit"}}>click me</a>{{/with}}')
  });

  appendView();

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The event handler was called");
});

test("should unregister event handlers on rerender", function() {
  var eventHandlerWasCalled = false;

  view = EmberView.extend({
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>click me</a>'),
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  appendView();

  var previousActionId = view.$('a[data-ember-action]').attr('data-ember-action');

  run(function() {
    view.rerender();
  });

  ok(!ActionHelper.registeredActions[previousActionId], "On rerender, the event handler was removed");

  var newActionId = view.$('a[data-ember-action]').attr('data-ember-action');

  ok(ActionHelper.registeredActions[newActionId], "After rerender completes, a new event handler was added");
});

test("should unregister event handlers on inside virtual views", function() {
  var things = Ember.A([
    {
      name: 'Thingy'
    }
  ]);
  view = EmberView.create({
    template: EmberHandlebars.compile('{{#each view.things}}<a href="#" {{action "edit"}}>click me</a>{{/each}}'),
    things: things
  });

  appendView();

  var actionId = view.$('a[data-ember-action]').attr('data-ember-action');

  run(function() {
    things.removeAt(0);
  });

  ok(!ActionHelper.registeredActions[actionId], "After the virtual view was destroyed, the action was unregistered");
});

test("should properly capture events on child elements of a container with an action", function() {
  var eventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<div {{action "edit"}}><button>click me</button></div>')
  });

  appendView();

  view.$('button').trigger('click');

  ok(eventHandlerWasCalled, "Event on a child element triggered the action of it's parent");
});

test("should allow bubbling of events from action helper to original parent event", function() {
  var eventHandlerWasCalled = false,
      originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>click me</a>'),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  appendView();

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled && originalEventHandlerWasCalled, "Both event handlers were called");
});

test("should not bubble an event from action helper to original parent event if `bubbles=false` is passed", function() {
  var eventHandlerWasCalled = false,
      originalEventHandlerWasCalled = false;

  var controller = EmberController.extend({
    actions: { edit: function() { eventHandlerWasCalled = true; } }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "edit" bubbles=false}}>click me</a>'),
    click: function() { originalEventHandlerWasCalled = true; }
  });

  appendView();

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The child handler was called");
  ok(!originalEventHandlerWasCalled, "The parent handler was not called");
});

test("should allow 'send' as action name (#594)", function() {
  var eventHandlerWasCalled = false;
  var eventObjectSent;

  var controller = EmberController.extend({
    send: function() { eventHandlerWasCalled = true; }
  }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<a href="#" {{action "send" }}>send</a>')
  });

  appendView();

  view.$('a').trigger('click');

  ok(eventHandlerWasCalled, "The view's send method was called");
});


test("should send the view, event and current Handlebars context to the action", function() {
  var passedTarget;
  var passedContext;

  var aTarget = EmberController.extend({
    actions: {
      edit: function(context) {
        passedTarget = this;
        passedContext = context;
      }
    }
  }).create();

  var aContext = { aTarget: aTarget };

  view = EmberView.create({
    aContext: aContext,
    template: EmberHandlebars.compile('{{#with view.aContext}}<a id="edit" href="#" {{action "edit" this target="aTarget"}}>edit</a>{{/with}}')
  });

  appendView();

  view.$('#edit').trigger('click');

  strictEqual(passedTarget, aTarget, "the action is called with the target as this");
  strictEqual(passedContext, aContext, "the parameter is passed along");
});

test("should only trigger actions for the event they were registered on", function() {
  var editWasCalled = false;

  view = EmberView.extend({
    template: EmberHandlebars.compile('<a href="#" {{action "edit"}}>edit</a>'),
    actions: { edit: function() { editWasCalled = true; } }
  }).create();

  appendView();

  view.$('a').trigger('mouseover');

  ok(!editWasCalled, "The action wasn't called");
});

test("should unwrap controllers passed as a context", function() {
  var passedContext,
      model = EmberObject.create(),
      controller = EmberObjectController.extend({
        model: model,
        actions: {
          edit: function(context) {
            passedContext = context;
          }
        }
      }).create();

  view = EmberView.create({
    controller: controller,
    template: EmberHandlebars.compile('<button {{action "edit" this}}>edit</button>')
  });

  appendView();

  view.$('button').trigger('click');

  equal(passedContext, model, "the action was passed the unwrapped model");
});

test("should allow multiple contexts to be specified", function() {
  var passedContexts,
      models = [EmberObject.create(), EmberObject.create()];

  var controller = EmberController.extend({
    actions: {
      edit: function() {
        passedContexts = [].slice.call(arguments);
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    modelA: models[0],
    modelB: models[1],
    template: EmberHandlebars.compile('<button {{action "edit" view.modelA view.modelB}}>edit</button>')
  });

  appendView();

  view.$('button').trigger('click');

  deepEqual(passedContexts, models, "the action was called with the passed contexts");
});

test("should allow multiple contexts to be specified mixed with string args", function() {
  var passedParams,
      model = EmberObject.create();

  var controller = EmberController.extend({
    actions: {
      edit: function() {
        passedParams = [].slice.call(arguments);
      }
    }
  }).create();

  view = EmberView.create({
    controller: controller,
    modelA: model,
    template: EmberHandlebars.compile('<button {{action "edit" "herp" view.modelA}}>edit</button>')
  });

  appendView();

  view.$('button').trigger('click');

  deepEqual(passedParams, ["herp", model], "the action was called with the passed contexts");
});

var namespace = {
  "Component": {
    toString: function() { return "Component"; },
    find: function() { return { id: 1 }; }
  }
};

var compile = function(string) {
  return EmberHandlebars.compile(string);
};

test("it does not trigger action with special clicks", function() {
  var showCalled = false;

  view = EmberView.create({
    template: compile("<a {{action 'show' href=true}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() {
        showCalled = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  function checkClick(prop, value, expected) {
    var event = jQuery.Event("click");
    event[prop] = value;
    view.$('a').trigger(event);
    if (expected) {
      ok(showCalled, "should call action with "+prop+":"+value);
      ok(event.isDefaultPrevented(), "should prevent default");
    } else {
      ok(!showCalled, "should not call action with "+prop+":"+value);
      ok(!event.isDefaultPrevented(), "should not prevent default");
    }
  }

  checkClick('ctrlKey', true, false);
  checkClick('altKey', true, false);
  checkClick('metaKey', true, false);
  checkClick('shiftKey', true, false);
  checkClick('which', 2, false);

  checkClick('which', 1, true);
  checkClick('which', undefined, true); // IE <9
});

test("it can trigger actions for keyboard events", function() {
  var showCalled = false;

  view = EmberView.create({
    template: compile("<input type='text' {{action 'show' on='keyUp'}}>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() {
        showCalled = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var event = jQuery.Event("keyup");
  event.char = 'a';
  event.which = 65;
  view.$('input').trigger(event);
  ok(showCalled, "should call action with keyup");
});

test("a quoteless parameter should allow dynamic lookup of the actionName", function(){
  expect(4);
  var lastAction, actionOrder = [];

  view = EmberView.create({
    template: compile("<a id='woot-bound-param'' {{action hookMeUp}}>Hi</a>")
  });

  var controller = EmberController.extend({
    hookMeUp: 'biggityBoom',
    actions: {
      biggityBoom: function() {
        lastAction = 'biggityBoom';
        actionOrder.push(lastAction);
      },
      whompWhomp: function() {
        lastAction = 'whompWhomp';
        actionOrder.push(lastAction);
      },
      sloopyDookie: function(){
        lastAction = 'sloopyDookie';
        actionOrder.push(lastAction);
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var testBoundAction = function(propertyValue){
    controller.set('hookMeUp', propertyValue);

    run(function(){
      view.$("#woot-bound-param").click();
    });

    equal(lastAction, propertyValue, 'lastAction set to ' + propertyValue);
  };

  testBoundAction('whompWhomp');
  testBoundAction('sloopyDookie');
  testBoundAction('biggityBoom');

  deepEqual(actionOrder, ['whompWhomp', 'sloopyDookie', 'biggityBoom'], 'action name was looked up properly');
});

test("a quoteless parameter should lookup actionName in context", function(){
  expect(4);
  var lastAction, actionOrder = [];

  view = EmberView.create({
    template: compile("{{#each allactions}}<a {{bind-attr id='name'}} {{action name}}>{{title}}</a>{{/each}}")
  });

  var controller = EmberController.extend({
    allactions: Ember.A([{title: 'Biggity Boom',name: 'biggityBoom'},
                         {title: 'Whomp Whomp',name: 'whompWhomp'},
                         {title: 'Sloopy Dookie',name: 'sloopyDookie'}]),
    actions: {
      biggityBoom: function() {
        lastAction = 'biggityBoom';
        actionOrder.push(lastAction);
      },
      whompWhomp: function() {
        lastAction = 'whompWhomp';
        actionOrder.push(lastAction);
      },
      sloopyDookie: function(){
        lastAction = 'sloopyDookie';
        actionOrder.push(lastAction);
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var testBoundAction = function(propertyValue){
    run(function(){
      view.$("#"+propertyValue).click();
    });

    equal(lastAction, propertyValue, 'lastAction set to ' + propertyValue);
  };

  testBoundAction('whompWhomp');
  testBoundAction('sloopyDookie');
  testBoundAction('biggityBoom');

  deepEqual(actionOrder, ['whompWhomp', 'sloopyDookie', 'biggityBoom'], 'action name was looked up properly');
});

test("a quoteless parameter that also exists as an action name functions properly", function(){
  Ember.TESTING_DEPRECATION = true;
  var triggeredAction;

  view = EmberView.create({
    template: compile("<a id='oops-bound-param'' {{action ohNoeNotValid}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      ohNoeNotValid: function() {
        triggeredAction = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  run(function(){
    view.$("#oops-bound-param").click();
  });

  ok(triggeredAction, 'the action was triggered');
});

test("a quoteless parameter that also exists as an action name results in an assertion", function(){
  var triggeredAction;

  view = EmberView.create({
    template: compile("<a id='oops-bound-param' {{action ohNoeNotValid}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      ohNoeNotValid: function() {
        triggeredAction = true;
      }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var oldAssert = Ember.assert;
  Ember.assert = function(message, test){
    ok(test, message + " -- was properly asserted");
  };

  run(function(){
    view.$("#oops-bound-param").click();
  });

  ok(triggeredAction, 'the action was triggered');

  Ember.assert = oldAssert;
});

test("a quoteless parameter that also exists as an action name in deprecated action in controller style results in an assertion", function(){
  var dropDeprecatedActionStyleOrig = Ember.FEATURES['ember-routing-drop-deprecated-action-style'];
  Ember.FEATURES['ember-routing-drop-deprecated-action-style'] = false;

  var triggeredAction;

  view = EmberView.create({
    template: compile("<a id='oops-bound-param' {{action ohNoeNotValid}}>Hi</a>")
  });

  var controller = EmberController.extend({
    ohNoeNotValid: function() {
      triggeredAction = true;
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var oldAssert = Ember.assert;
  Ember.assert = function(message, test){
    ok(test, message + " -- was properly asserted");
  };

  run(function(){
    view.$("#oops-bound-param").click();
  });

  ok(triggeredAction, 'the action was triggered');

  Ember.assert = oldAssert;
  Ember.FEATURES['ember-routing-drop-deprecated-action-style'] = dropDeprecatedActionStyleOrig;
});

module("Ember.Handlebars - action helper - deprecated invoking directly on target", {
  setup: function() {
    originalActionHelper = EmberHandlebars.helpers['action'];
    EmberHandlebars.registerHelper('action', actionHelper);

    dispatcher = EventDispatcher.create();
    dispatcher.setup();
  },

  teardown: function() {
    delete EmberHandlebars.helpers['action'];
    EmberHandlebars.helpers['action'] = originalActionHelper;

    run(function() {
      dispatcher.destroy();
      if (view) { view.destroy(); }
    });
  }
});

if (!Ember.FEATURES.isEnabled('ember-routing-drop-deprecated-action-style')) {
  test("should invoke a handler defined directly on the target (DEPRECATED)", function() {
    var eventHandlerWasCalled,
        model = EmberObject.create();

    var controller = EmberController.extend({
      edit: function() {
        eventHandlerWasCalled = true;
      }
    }).create();

    view = EmberView.create({
      controller: controller,
      template: EmberHandlebars.compile('<button {{action "edit"}}>edit</button>')
    });

    appendView();

    expectDeprecation(/Action handlers implemented directly on controllers are deprecated/);

    view.$('button').trigger('click');

    ok(eventHandlerWasCalled, "the action was called");
  });
}

test("should respect preventDefault=false option if provided", function(){
  view = EmberView.create({
    template: compile("<a {{action 'show' preventDefault=false}}>Hi</a>")
  });

  var controller = EmberController.extend({
    actions: {
      show: function() { }
    }
  }).create();

  run(function() {
    view.set('controller', controller);
    view.appendTo('#qunit-fixture');
  });

  var event = jQuery.Event("click");
  view.$('a').trigger(event);

  equal(event.isDefaultPrevented(), false, "should not preventDefault");
});
