import React from 'react'

export class Legacy extends React.Component {
  UNSAFE_componentWillMount() {}

  render() {
    return <div>{this.refs.box}</div>
  }
}
