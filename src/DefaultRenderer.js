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
import {
  Animated,
  View,
  StyleSheet,
  Dimensions,
  Easing,
  NavigationExperimental
} from 'react-native';

import TabBar from './TabBar';
import NavBar from './NavBar';
import Actions from './Actions';
import { deepestExplicitValueForKey } from './Util';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const SCREEN_WIDTH = Dimensions.get('window').width;

const {
  Transitioner: NavigationTransitioner,
  Card: NavigationCard,
} = NavigationExperimental;

const {
  CardStackPanResponder: NavigationCardStackPanResponder,
  CardStackStyleInterpolator: NavigationCardStackStyleInterpolator,
} = NavigationCard;

const styles = StyleSheet.create({
  animatedView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sceneStyle: {
    flex: 1,
  },
});

function fadeInScene(/* NavigationSceneRendererProps */ props) {
  const {
    position,
    scene,
  } = props;

  const index = scene.index;
  const inputRange = [index - 1, index, index + 1];

  const opacity = position.interpolate({
    inputRange,
    outputRange: [0, 1, 0.3],
  });

  const scale = position.interpolate({
    inputRange,
    outputRange: [1, 1, 0.95],
  });

  const translateY = 0;
  const translateX = 0;

  return {
    opacity,
    transform: [
      { scale },
      { translateX },
      { translateY },
    ],
  };
}

function leftToRight(/* NavigationSceneRendererProps */ props) {
  const {
    position,
    scene,
  } = props;

  const index = scene.index;
  const inputRange = [index - 1, index, index + 1];

  const translateX = position.interpolate({
    inputRange,
    outputRange: [-SCREEN_WIDTH, 0, 0],
  });

  return {
    transform: [
      { translateX },
    ],
  };
}

export default class DefaultRenderer extends Component {

  static propTypes = {
    navigationState: PropTypes.object,
    onNavigate: PropTypes.func,
  };

  static childContextTypes = {
    navigationState: PropTypes.any,
  };

  constructor(props) {
    super(props);

    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
    this.renderCard = this.renderCard.bind(this);
    this.renderScene = this.renderScene.bind(this);
    this.renderHeader = this.renderHeader.bind(this);
    this.renderCardAndHeader= this.renderCardAndHeader.bind(this);
  }

  getChildContext() {
    return {
      navigationState: this.props.navigationState,
    };
  }

  componentDidMount() {
    this.dispatchFocusAction(this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.navigationState !== this.props.navigationState) {
      this.dispatchFocusAction(nextProps);
    }
  }

  getPanHandlers(direction, props) {
    return direction === 'vertical' ?
      NavigationCardStackPanResponder.forVertical(props) :
      NavigationCardStackPanResponder.forHorizontal(props);
  }

  dispatchFocusAction({ navigationState }) {
    if (!navigationState || navigationState.component || navigationState.tabs) {
      return;
    }
    const scene = navigationState.routes[navigationState.index];
    Actions.focus({ scene });
  }

  chooseInterpolator(direction, props) {
    switch (direction) {
      case 'vertical':
        return NavigationCardStackStyleInterpolator.forVertical(props);
      case 'fade':
        return fadeInScene(props);
      case 'leftToRight':
        return leftToRight(props);
      default:
        return NavigationCardStackStyleInterpolator.forHorizontal(props);
    }
  }

  renderCard(/* NavigationSceneRendererProps */ props) {
    const { key,
      direction,
      animation,
      getSceneStyle,
      getPanHandlers,
    } = props.scene.route;

    const state = props.navigationState;
    const child = state.routes[state.index];
    let selected = state.routes[state.index];
    while (selected.hasOwnProperty('routes')) {
      selected = selected.routes[selected.index];
    }
    let { panHandlers, animationStyle } = selected;
    const isActive = child === selected;
    const computedProps = { isActive };
    if (isActive) {
      computedProps.hideNavBar = deepestExplicitValueForKey(props.navigationState, 'hideNavBar');
      computedProps.hideTabBar = deepestExplicitValueForKey(props.navigationState, 'hideTabBar');
    }

    const style = getSceneStyle ? getSceneStyle(props, computedProps) : null;

    // direction overrides animation if both are supplied
    const animType = (animation && !direction) ? animation : direction;

    if (typeof(animationStyle) === 'undefined') {
      animationStyle = this.chooseInterpolator(animType, props);
    }

    if (typeof(animationStyle) === 'function') {
      animationStyle = animationStyle(props);
    }

    if (typeof(panHandlers) === 'undefined') {
      panHandlers = getPanHandlers ? getPanHandlers(props) : this.getPanHandlers(direction, props);
    }
    return (
      <NavigationCard
        {...props}
        key={`card_${key}`}
        style={[animationStyle, style]}
        panHandlers={panHandlers}
        renderScene={this.renderScene}
      />
    );
  }

  renderCardAndHeader(props) {
    return (<View style={{flex:1}}>
      {this.renderCard(props)}
      {this.renderHeader(props)}
      </View>)
  }

  renderScene(/* NavigationSceneRendererProps */ props) {
    return (
      <DefaultRenderer
        key={props.scene.route.key}
        onNavigate={this.props.onNavigate}
        navigationState={props.scene.route}
      />
    );
  }

  renderHeader(/* NavigationSceneRendererProps */ props) {
    const state = props.navigationState;
    const child = state.routes[state.index];
    let selected = state.routes[state.index];
    while (selected.hasOwnProperty('routes')) {
      selected = selected.routes[selected.index];
    }
    if (child !== selected) {
      // console.log(`SKIPPING renderHeader because ${child.key} !== ${selected.key}`);
      return null;
    }
    const hideNavBar = deepestExplicitValueForKey(state, 'hideNavBar');
    if (hideNavBar) {
      // console.log(`SKIPPING renderHeader because ${child.key} hideNavBar === true`);
      return null;
    }

    // console.log(`renderHeader for ${child.key}`);

    if (selected.component && selected.component.renderNavigationBar) {
      return selected.component.renderNavigationBar({ ...props, ...selected });
    }

    const HeaderComponent = selected.navBar || child.navBar || state.navBar || NavBar;
    const navBarProps = { ...state, ...child, ...selected };

    if (selected.component && selected.component.onRight) {
      navBarProps.onRight = selected.component.onRight;
    }

    if (selected.component && selected.component.onLeft) {
      navBarProps.onLeft = selected.component.onLeft;
    }

    if ((navBarProps.leftTitle || navBarProps.leftButtonImage) && navBarProps.onLeft) {
      delete navBarProps.leftButton;
    }

    if ((navBarProps.rightTitle || navBarProps.rightButtonImage) && navBarProps.onRight) {
      delete navBarProps.rightButton;
    }

    if (navBarProps.rightButton) {
      delete navBarProps.rightTitle;
      delete navBarProps.onRight;
      delete navBarProps.rightButtonImage;
    }

    if (navBarProps.leftButton) {
      delete navBarProps.leftTitle;
      delete navBarProps.onLeft;
      delete navBarProps.leftButtonImage;
    }
    delete navBarProps.style;

    const getTitle = selected.getTitle || (opts => opts.title);
    return <HeaderComponent {...props} {...navBarProps} getTitle={getTitle} />;
  }

  render() {
    const { navigationState, onNavigate } = this.props;

    if (!navigationState || !onNavigate) {
      console.error('navigationState and onNavigate property should be not null');
      return null;
    }

    let SceneComponent = navigationState.component;

    if (navigationState.tabs && !SceneComponent) {
      SceneComponent = TabBar;
    }

    if (SceneComponent) {
      return (
        <View
          style={[styles.sceneStyle, navigationState.sceneStyle]}
        >
          <SceneComponent {...this.props} {...navigationState} />
        </View>
      );
    }

    const optionals = {};
    const selected = navigationState.routes[navigationState.index];

    const configureTransition = selected.configureTransition || navigationState.configureTransition;
    const style = selected.style || navigationState.style;

    function defaultConfigureTransition() {
      const easing: any = Easing.inOut(Easing.quad);
      return {
        duration: 200,
        easing,
      };
    }

    optionals.configureTransition = defaultConfigureTransition;
    if (configureTransition){
      options.configureTransition = configureTransition;
    }
    else{
      let duration = selected.duration;
      let easing = selected.easing || navigationState.easing || Easing.inOut(Easing.quad);
      if (duration === null || duration === undefined) duration = navigationState.duration;
      if (duration !== null && duration !== undefined) {
        optionals.configureTransition = (easing) => {
          duration,
          easing
        };
      }
    }

    // console.log(`NavigationAnimatedView for ${navigationState.key}`);

    return (
      <NavigationTransitioner
        navigationState={navigationState}
        style={[styles.animatedView, style]}
        render={this.renderCardAndHeader}
        {...optionals}
      />
    );
  }
}
