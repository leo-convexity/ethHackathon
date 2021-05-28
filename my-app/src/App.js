import logo from './logo.svg';
import './App.css';
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

//clicking the button updates the current exchange rate
class Info extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: "CLICK TO UPDATE"};
  }
  render() {
    return (
      <button className="square" onClick={
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
       <button onClick={
        () => ethereum.request({ method: 'eth_requestAccounts' }).then(
                result => this.setState({value: result})
      )}>
      {this.state.value}
      </button>
    );
  }
}

function App() {
 
  {/*
  //bit of code to test on console to see how the account changes work
    if (ethereum) {
    ethereum.on('accountsChanged', function (accounts){
      //time to reload your interface with accounts[0]!
      console.log(accounts[0])
    })
  
  }
*/}
  

  return (
    <div className="App">
      <header className="App-header">
        Your etherum address
        <Info/>
        <br />
        <EthButton/>
        
      </header>
    </div>
  );
}

export default App;