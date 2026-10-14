import React from 'react';
export class App extends React.Component {
  componentDidUpdate() { this.setState({ a: 1 }); }
  render() { return null; }
}
