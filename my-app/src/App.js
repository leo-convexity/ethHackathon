import style from './App.css';
import React from 'react';

//copy pasted the config file from api-guide-example 
const config = require('./config.json');

const Web3 = require('web3');
//changed to givenProvider to see if we can work with MetaMask
//set MetaMask to rinkleby to make sure the ABI and contract addresses work
const web3 = new Web3(Web3.givenProvider);

//here are the cUSDC address and ABI
const cUsdcAddress = config.cUsdcAddress;
const cUsdcAbi = config.cUsdcAbi;
const cUsdcContract = new web3.eth.Contract(cUsdcAbi, cUsdcAddress);
const ethereum = window.ethereum;

const styles = {
  
  height: 50,
  backgroundColor: 'green'
};

//clicking the button updates the current exchange rate
class Info extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: "CLICK TO UPDATE"};
  }
  render() {
    return (
      <button onClick={
        () => cUsdcContract.methods.exchangeRateCurrent().call().then(
                result => this.setState({value: result/1e16})
              )
      }>
      {this.state.value}
      </button>
    );
  }
}
//add button that connects to metamask
class EthButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: "Connect MetaMask"};
  }
  render() {
    return (
       <button style = {styles} onClick={
        () => ethereum.request({ method: 'eth_requestAccounts' }).then(
                result => this.setState({value: result})
      )}>
      {this.state.value}
      </button>
    );
  }
}

//a form that takes a number input from the user
class DepositForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: ''};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
  }

  handleSubmit(event) {
    alert('You want to deposit ' + this.state.value + ' USDC');
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Fixed Rate Deposit Amount :
          <input type="number" value={this.state.value} onChange={this.handleChange} />
        </label>
        <input type="submit" value="Deposit" />
      </form>
    );
  }
}

class FixedRate extends React.Component{
  constructor(props){
    super(props);
  }
  render(){
    return (
        <div>
          Your Fixed Rate will be x%
        </div>
    )
  }
}


function App() {
 
  
  

  return (
    <div className="App">
      <header className="App-header">
        <EthButton/>
        <br />        
        The cUSDC Exchange Rate is :
        <Info />
        <br />
        <DepositForm/>
        <br />
        <FixedRate />
      </header>
    </div>
  );
}

export default App;