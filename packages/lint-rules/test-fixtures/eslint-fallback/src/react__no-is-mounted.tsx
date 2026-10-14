import React from 'react';
export class App extends React.Component {
  handle() { if (this.isMounted()) { return; } }
  render() { return null; }
}
