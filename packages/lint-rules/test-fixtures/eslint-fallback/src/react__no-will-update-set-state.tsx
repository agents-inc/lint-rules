import React from 'react'
export class C extends React.Component {
  componentWillUpdate() { this.setState({ a: 1 }) }
  render() { return <div /> }
}
