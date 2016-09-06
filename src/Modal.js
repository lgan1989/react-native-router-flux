import React, {
  PropTypes,
} from 'react';
import {
  View,
} from 'react-native';
import DefaultRenderer from './DefaultRenderer';

const propTypes = {
  navigationState: PropTypes.shape({
    routes: PropTypes.array,
  }),
  onNavigate: PropTypes.func,
};

export default function Modal(props: Object) {
  const routes= props.navigationState.routes;
  const state = routes[0];

  return (
    <View style={{ flex: 1 }}>
      <DefaultRenderer
        navigationState={state}
        key={state.key}
        {...state}
        onNavigate={props.onNavigate}
      />
      {routes.length > 1 && routes.map((el, i) => {
        if (i > 0 && el.component) {
          const Component = el.component;
          return <Component key={el.key} {...el} />;
        }

        return null;
      })}
    </View>
  );
}

Modal.propTypes = propTypes;
