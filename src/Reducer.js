/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable no-param-reassign */

import * as ActionConst from './ActionConst';
import { ActionMap } from './Actions';
import { assert } from './Util';
import { getInitialState } from './State';
import { Platform } from 'react-native';

// WARN: it is not working correct. rewrite it.
function checkPropertiesEqual(action, lastAction) {
  let isEqual = true;
  for (const key of Object.keys(action)) {
    if (['key', 'type', 'parent'].indexOf(key) === -1) {
      if (action[key] !== lastAction[key]) {
        isEqual = false;
      }
    }
  }
  return isEqual;
}

function resetHistoryStack(child) {
  const newChild = child;
  newChild.index = 0;
  child.routes.map(
    (el, i) => {
      if (el.initial) {
        newChild.index = i;
        if (!newChild.tabs) {
          newChild.routes= [el];
        }
      }
      if (el.routes) {
        resetHistoryStack(el);
      }
      return newChild;
    }
  );
}

function refreshTopChild(routes, refresh) {
  if (refresh) {
    const topChild = routes[routes.length - 1];
    return [...routes.slice(0, -1), { ...topChild, ...refresh }];
  }
  return routes;
}

function inject(state, action, props, scenes) {
  const condition = ActionMap[action.type] === ActionConst.REFRESH ? state.key === props.key ||
  state.sceneKey === action.key : state.sceneKey === props.parent;
  // console.log("INJECT:", action.key, state.sceneKey, condition);
  if (!condition) {
    if (state.routes) {
      const res = state.routes.map(el => inject(el, action, props, scenes));
      let changed = false;
      let changedIndex = -1;
      for (let i = 0; i < res.length; i++) {
        if (res[i] !== state.routes[i]) {
          changed = true;
          changedIndex = i;
          break;
        }
      }
      return changed ? { ...state, routes: res, index: changedIndex } : state;
    }
    return state;
  }
  let ind;

  switch (ActionMap[action.type]) {
    case ActionConst.POP_TO: {
      const targetIndex = action.targetIndex;

      return {
        ...state,
        index: targetIndex,
        routes: refreshTopChild(state.routes.slice(0, (targetIndex + 1)), action.refresh),
      };
    }

    case ActionConst.BACK:
    case ActionConst.BACK_ACTION: {
      assert(!state.tabs, 'pop() operation cannot be run on tab bar (tabs=true)');

      if (Platform.OS === 'android') {
        assert(state.index > 0, 'You are already in the root scene.');
      }

      if (state.index === 0) {
        return state;
      }

      let popNum = 1;
      if (action.popNum) {
        assert(typeof(action.popNum) === 'number',
          'The data is the number of scenes you want to pop, it must be Number');
        popNum = action.popNum;
        assert(popNum % 1 === 0,
          'The data is the number of scenes you want to pop, it must be integer.');
        assert(popNum > 1,
          'The data is the number of scenes you want to pop, it must be bigger than 1.');
        assert(popNum <= state.index,
          'The data is the number of scenes you want to pop, ' +
          "it must be smaller than scenes stack's length.");
      }

      return {
        ...state,
        index: state.index - popNum,
        from: state.routes[state.routes.length - popNum],
        routes: refreshTopChild(state.routes.slice(0, -1 * popNum), action.refresh),
      };
    }
    case ActionConst.REFRESH:
      return props.base ?
      { navBar: state.navBar,
        ...scenes.rootProps,
        ...props,
        key: state.key,
        from: null }
        : { ...state,
        ...props,
        key: state.key,
        from: null,
      };
    case ActionConst.PUSH_OR_POP:
      ind = state.routes.findIndex(el => el.sceneKey === action.key);
      if (ind !== -1) {
        return {
          ...state,
          index: ind,
          from: state.routes[state.index],
          routes: refreshTopChild(state.routes.slice(0, ind + 1), action.refresh),
        };
      }
      return {
        ...state,
        index: state.index + 1,
        from: null,
        routes: [...state.routes, getInitialState(props, scenes, state.index + 1, action)],
      };
    case ActionConst.PUSH:
      if (state.routes[state.index].sceneKey === action.key && !props.clone
        && checkPropertiesEqual(action, state.routes[state.index])) {
        return state;
      }
      return {
        ...state,
        index: state.index + 1,
        from: null,
        routes: [...state.routes, getInitialState(props, scenes, state.index + 1, action)],
      };
    case ActionConst.JUMP:
      assert(state.tabs, `Parent=${state.key} is not tab bar, jump action is not valid`);
      ind = -1;
      state.routes.forEach((c, i) => { if (c.sceneKey === action.key) { ind = i; } });
      assert(ind !== -1, `Cannot find route with key=${action.key} for parent=${state.key}`);

      if (action.unmountScenes) {
        resetHistoryStack(state.routes[ind]);
      }
      return { ...state, index: ind };
    case ActionConst.REPLACE:
      if (state.routes[state.index].sceneKey === action.key) {
        return state;
      }

      state.routes[state.routes.length - 1] = getInitialState(
        props,
        scenes,
        state.index,
        action
      );

      return { ...state, routes: state.routes};
    case ActionConst.RESET:
      if (state.routes[state.index].sceneKey === action.key) {
        return state;
      }

      state.routes= state.routes.splice(0, 1);
      state.routes[0] = getInitialState(props, scenes, state.index, action);

      return {
        ...state,
        index: 0,
        from: null,
        routes: state.routes,
      };
    default:
      return state;
  }
}

export function findElement(state, key, type) {
  if ((ActionMap[type] === ActionConst.REFRESH && state.key === key) || state.sceneKey === key) {
    return state;
  }
  if (state.routes) {
    for (const child of state.routes) {
      const current = findElement(child, key, type);
      if (current) return current;
    }
  }
  return null;
}

function getCurrent(state) {
  if (!state.routes) {
    return state;
  }
  return getCurrent(state.routes[state.index]);
}

function update(state, action) {
  // find parent in the state
  const props = { ...state.scenes[action.key], ...action };
  assert(props.parent, `No parent is defined for route=${action.key}`);
  return inject(state, action, props, state.scenes);
}

function reducer({ initialState, scenes }) {
  assert(initialState, 'initialState should not be null');
  assert(initialState.key, 'initialState.key should not be null');
  assert(scenes, 'scenes should not be null');
  return (stateParam, actionParam) => {
    let state = stateParam;
    let action = actionParam;
    state = state || { ...initialState, scenes };
    assert(action, 'action should be defined');
    assert(action.type, 'action type should be defined');
    assert(state.scenes, 'state.scenes is missed');

    if (action.key) {
      if (ActionMap[action.type] === ActionConst.REFRESH) {
        let key = action.key;
        let child = findElement(state, key, action.type) || state.scenes[key];
        let sceneKey = child.sceneKey;
        if (child.base) {
          child = { ...state.scenes[child.base], ...child };
          assert(state.scenes[child.base], `No scene exists for base=${child.base}`);
          key = state.scenes[child.base].key;
          sceneKey = state.scenes[child.base].sceneKey;
        }
        assert(child, `missed child data for key=${key}`);
        // evaluate functions within actions to allow conditional set, like switch values
        const evaluated = {};
        Object.keys(action).forEach(el => {
          if (typeof action[el] === 'function' && typeof child[el] !== 'undefined'
            && typeof child[el] !== typeof action[el]) {
            evaluated[el] = action[el](child[el], child);
          }
        });
        action = { ...child, ...action, ...evaluated, sceneKey, key };

        // console.log("REFRESH ACTION:", action);
      } else {
        const scene = state.scenes[action.key];
        assert(scene, `missed route data for key=${action.key}`);
        // clone scene
        if (scene.clone) {
          action.parent = getCurrent(state).parent;
        }
      }
    } else {
      // set current route for pop action or refresh action
      if (ActionMap[action.type] === ActionConst.BACK_ACTION ||
          ActionMap[action.type] === ActionConst.BACK ||
          ActionMap[action.type] === ActionConst.REFRESH ||
          ActionMap[action.type] === ActionConst.POP_TO) {
        if (!action.key && !action.parent) {
          action = { ...getCurrent(state), ...action };
        }
      }

      // Find the parent and index of the future state
      if (ActionMap[action.type] === ActionConst.POP_TO) {
        const target = action.data;
        assert(target, 'PopTo() must be called with scene name');

        const targetEl = findElement(state, target, action.type);
        assert(targetEl, `Cannot find element name named ${target} within current state`);

        // target is a node
        let parent = targetEl.sceneKey;
        let targetIndex = 0;

        // target is child of a node
        if (!targetEl.routes) {
          const targetParent = findElement(state, targetEl.parent, action.type);
          assert(targetParent, `Cannot find parent for target ${target}`);
          parent = targetParent.sceneKey;

          targetIndex = targetParent.routes.indexOf(targetEl);
          assert(targetIndex > -1, `${target} does not belong to ${targetParent.sceneKey}`);
        }

        action.parent = parent;
        action.targetIndex = targetIndex;
      }

      // recursive pop parent
      if (ActionMap[action.type] === ActionConst.BACK_ACTION ||
          ActionMap[action.type] === ActionConst.BACK) {
        const parent = action.parent || state.scenes[action.key].parent;
        let el = findElement(state, parent, action.type);
        while (el.parent && (el.routes.length <= 1 || el.tabs)) {
          el = findElement(state, el.parent, action.type);
          assert(el, `Cannot find element for parent=${el.parent} within current state`);
        }
        action.parent = el.sceneKey;
      }
    }

    switch (ActionMap[action.type]) {
      case ActionConst.BACK:
      case ActionConst.BACK_ACTION:
      case ActionConst.POP_TO:
      case ActionConst.REFRESH:
      case ActionConst.PUSH:
      case ActionConst.PUSH_OR_POP:
      case ActionConst.JUMP:
      case ActionConst.REPLACE:
      case ActionConst.RESET:
        return update(state, action);

      default:
        return state;

    }
  };
}

export default reducer;
