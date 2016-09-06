/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import React, {
  Component,
  PropTypes,
} from 'react';
import {BackAndroid } from 'react-native';

import Actions, { ActionMap } from './Actions';
import getInitialState from './State';
import Reducer, { findElement } from './Reducer';
import DefaultRenderer from './DefaultRenderer';
import Scene from './Scene';
import * as ActionConst from './ActionConst';

const propTypes = {
  dispatch: PropTypes.func,
  backAndroidHandler: PropTypes.func,
  onBackAndroid: PropTypes.func,
  onExitApp: PropTypes.func,
};

class Router extends Component {

  constructor(props) {
    super(props);
    this.handleAction = this.handleAction.bind(this);
    this.renderNavigation = this.renderNavigation.bind(this);
    this.handleProps = this.handleProps.bind(this);
    this.handleBackAndroid = this.handleBackAndroid.bind(this);
  }

  componentDidMount() {
    this.handleProps(this.props);

    BackAndroid.addEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  componentWillReceiveProps(props) {
    this.handleProps(props);
  }

  componentWillUnmount() {
    BackAndroid.removeEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  handleBackAndroid() {
    const {
      backAndroidHandler,
      onBackAndroid,
      onExitApp,
    } = this.props;
    // optional for customizing handler
    if (backAndroidHandler) {
      return backAndroidHandler();
    }

    try {
      Actions.pop();
      if (onBackAndroid) {
        onBackAndroid();
      }
      return true;
    } catch (err) {
      if (onExitApp) {
        return onExitApp();
      }

      return false;
    }
  }

  handleProps(props) {
    let scenesMap;

    if (props.scenes) {
      scenesMap = props.scenes;
    } else {
      let scenes = props.children;

      if (Array.isArray(props.children) || props.children.props.component) {
        scenes = (
          <Scene
            key="__root"
            hideNav
            {...this.props}
          >
            {props.children}
          </Scene>
        );
      }
      scenesMap = Actions.create(scenes, props.wrapBy);
    }

    // eslint-disable-next-line no-unused-vars
    const { children, styles, scenes, reducer, createReducer, ...parentProps } = props;

    scenesMap.rootProps = parentProps;

    const initialState = getInitialState(scenesMap);
    const reducerCreator = props.createReducer || Reducer;

    const routerReducer = props.reducer || (
      reducerCreator({
        initialState,
        scenes: scenesMap,
      }));

    this.routerReducer = routerReducer;
    const action = {type: 'REACT_NATIVE_ROUTER_FLUX_FOCUS'};
    this.setState(this.routerReducer(initialState, action));
  }

  handleAction(action) {
    if (!action){
      return false;
    }
    const newState = this.routerReducer(this.state, action);
    if (newState === this.state){
      return false;
    }
    this.setState(newState);
    return true;
  }

  renderNavigation() {
    Actions.get = key => findElement(navigationState, key, ActionConst.REFRESH);
    Actions.callback = props => {
      const constAction = (props.type && ActionMap[props.type] ? ActionMap[props.type] : null);
      if (this.props.dispatch) {
        if (constAction) {
          this.props.dispatch({ ...props, type: constAction });
        } else {
          this.props.dispatch(props);
        }
      }
      return (constAction ? this.handleAction({ ...props, type: constAction }) : this.handleAction(props));
    };

    return <DefaultRenderer onNavigate={this.handleAction} navigationState={this.state} />;
  }

  render() {
    if (!this.state) return false;
    return this.renderNavigation();
  }
}

Router.propTypes = propTypes;

export default Router;
