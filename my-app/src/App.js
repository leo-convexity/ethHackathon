import style from './App.css';
import React, { Component } from 'react';
import { render } from 'react-dom';

//copy pasted the config file from api-guide-example 
const config = require('./config_mainnet.json');
const Web3 = require('web3' || "http://127.0.0.1:8545");
//added big number
const bigNumber = require('bigNumber.js');

//changed to givenProvider to see if we can work with MetaMask
const web3 = new Web3(Web3.givenProvider);
//here are the cUSDC address and ABI
const cUsdcAddress = config.cUsdcAddress;
const cUsdcAbi = config.cUsdcAbi;
const cUsdcContract = new web3.eth.Contract(cUsdcAbi, cUsdcAddress);

//here we build the USDC contract and ABI
const usdcAddress = config.usdcAddress;
const usdcAbi = config.usdcAbi;
const usdcContract = new web3.eth.Contract(usdcAbi, usdcAddress);

const ethereum = window.ethereum;

//calculating fixed rate deposits
//expiryDate should come from the smartContract that defines the cTokenFuture
const expiryDate = new Date('June 25 2021');
var today = new Date();
var msPerYear = 24 * 60 * 60 * 1000 *365; // Number of milliseconds per year
var dayCount = (expiryDate.getTime() - today.getTime()) / msPerYear; //returns the daycount in terms of fraction of year left in milliseconds
console.log('daycount = ' + dayCount);
//creating variables that will later reference the blockchain - will need to make this so it somehow updates if something changes 
var exchangeRateCurrent = 0.02222;
var cTokenFuturePrice = 0.022645;
var fixedImpliedRate = (cTokenFuturePrice/exchangeRateCurrent-1)*(1/dayCount)*100;
console.log('exchangeRateCurrent = ' + exchangeRateCurrent);

const styles = {
  height: 50,
  backgroundColor: 'green'
};

//approveToken function
function approveToken(tokenInstance, receiver, amount) {
  tokenInstance.methods.approve(receiver, amount).send({ from: fromAddress }, async function(error, txHash) {
      if (error) {
          console.log("ERC20 could not be approved", error);
          return;
      }
      console.log("ERC20 token approved to " + receiver);
      const status = await waitTransaction(txHash);
      if (!status) {
          console.log("Approval transaction failed.");
          return;
      }
  })
}
class Ticker extends Component{

  componentDidMount(){
    this.loadBlockchainData()
  }
  async loadBlockchainData () {
    const accounts = await web3.eth.getAccounts()
    this.setState({account: accounts[0]})
    console.log('acccount : ' +accounts[0])
    this.setState({ cUsdcContract })
    const exchangeRateCurrent = await cUsdcContract.methods.exchangeRateCurrent().call()
    this.setState({ exchangeRateCurrent})

  }

  constructor(props){
    super(props)
    this.state = { account: ''}
  }

  render(){
    return (
      <div>
        <p>cUSDC exchange rate : {this.state.exchangeRateCurrent/10**16}</p>
      </div>
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

  async handleSubmit(event) {
    //this is where we ask smart contracts
    //deposit will be a mint
    //the contract will ask for approval first
    const adj_quantity = this.state.value*1e18;
    const accounts = await web3.eth.getAccounts();
    const adj_allowance = await usdcContract.methods.allowance(accounts[0], cUsdcAddress).call();
    console.log('allowance :' + adj_allowance);
    if(adj_allowance < adj_quantity){
      const transaction_hash = usdcContract.methods.approve(cusdcAddress, adj_quantity).send({'from': account})
    }
    //const mintResult = await cUsdcContract.methods.mint(this.state.value*10**18).send({from: accounts[0], value: 0});
    //console.log('result ' + mintResult);
    
    
    //alert('You want to deposit ' + this.state.value + ' USDC');
    event.preventDefault();
  }

  render() {
    return (
      <div className="input-group mb-3">
          <input type="number" className="form-control" placeholder="USDC Amount" aria-label="depositAmountInput" aria-describedby="basic-addon2" value={this.state.value} onChange={this.handleChange} />
          <div className="input-group-append">
          <button className="btn btn-outline-secondary" type="button" onClick={this.handleSubmit}>Deposit</button>
          </div>
      </div>
     // <form onSubmit={this.handleSubmit}>
     //       Fixed Rate Deposit Amount :
     //     <input className = "form-control form-control-lg" type="number"  />
     //   <input type="submit" value="Deposit" />
      //</form>
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
          Your Fixed Rate will be {fixedImpliedRate}%
        </div>
    )
  }
}


function App() {
  return (
    <div className="container">
      
        <EthButton/>
        <Ticker />       
        <br />
        <DepositForm/>
        <br />
        <FixedRate />

    </div>
  );
}



export default App;