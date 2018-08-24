require('events').EventEmitter.prototype._maxListeners = 100;

const fs = require('fs');
const path = require('path');

const assert = require('chai').assert;
const ganche = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganche.provider());

// Lightsteam Token Contract
const lightstreamTokenPath = path.resolve(__dirname, '../contracts/build/contracts', 'LightstreamToken.json');
const lightstreamTokenJSON = fs.readFileSync(lightstreamTokenPath, 'utf8');
const { abi: lightstreamTokenAbi, bytecode: lightstreamTokenBytecode } = JSON.parse(lightstreamTokenJSON);


/*
 * Helper functions used to for debugging and manipulating blockchain for tests
 */

function printData(testName, data) {
  console.log(`---------------------------------${testName}--------------------------------------`);
  console.log(data);
  console.log('----------------------------------------------------------------------------------');
}

const timeTravel = function (time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time], // 86400 is num seconds in day
      id: new Date().getTime()
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

const mineBlock = function () {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_mine"
    }, (err, result) => {
      if(err){ return reject(err) }
      return resolve(result)
    });
  })
};

/*
 * Global variables
 */

let accounts;
let lightstreamTokenContract;
let lightstreamTokenAddress;
let timeOffset = 3600 * 24 * 30; // 30 days
let startTime = Math.floor(new Date().getTime() /1000 + (3600 * 24));;
let endTime = startTime + timeOffset;
let walletAdress;

// convert ether to a Big Number so web3 doesn't complain
const etherInWei = web3.utils.toWei('1000000', 'ether');
const transferOrMintAmount = web3.utils.toBN(etherInWei);

/*
 * Before running tests deploy the token contract, deploy the crowdsale contract, and then tranfer
 * ownership of the token contract to the crowsale contract
 */

before(async ()=>{
  // get list of accounts provided by Ganche
  accounts = await web3.eth.getAccounts();
  walletAdress = accounts[9];

  // Deploy the Lightstream Token Contract
  lightstreamTokenContract = await new web3.eth.Contract(lightstreamTokenAbi)
    .deploy({ data: lightstreamTokenBytecode, arguments: []})
    .send({ from: accounts[0], gas: '4712388' });

  // Get the address of the Lightstream Token
  lightstreamTokenAddress = lightstreamTokenContract.options.address;
});

/*
 * Tests to that the Lightstream Token was deployed and has an address
 */

describe('The Lightsteam Token when paused', ()=> {
  it('The Lightstream Token Contract has been deployed and has an address', ()=> {
    assert.ok(lightstreamTokenContract.options.address);
  });

  it('The owner can pause the token', async ()=> {
    await lightstreamTokenContract.methods.pause().send({from: accounts[0], gas: '4712388'});

    const paused = await lightstreamTokenContract.methods.paused().call();
    // printData('paused', paused);
    assert.equal(true, paused);
  });

  // mint(address _to, uint256 _amount)
  it('Minting should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.mint(accounts[1], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('Minting - error', error);
      assert.equal(true, true);
    }
  });

  // function transfer(address _to, uint256 _value)
  it('transfer should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.transfer(accounts[1], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('transfer - error', error);
      assert.equal(true, true);
    }
  });


  // function transferFrom(address _from, address _to, uint256 _value)
  it('transferFrom should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.transferFrom(accounts[0], accounts[9], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('transferFrom - error', error);
      assert.equal(true, true);
    }
  });

  // function approve( address _spender, uint256 _value)
  it('approve should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.approve(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('approve - error', error);
      assert.equal(true, true);
    }
  });

  // function increaseApproval( address _spender, uint _addedValue)
  it('increaseApproval should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.increaseApproval(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('increaseApproval - error', error);
      assert.equal(true, true);
    }
  });

  // function decreaseApproval(address _spender, uint _subtractedValue)
  it('decreaseApproval should not work when the token is paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.increaseApproval(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(false, true);
    } catch(error){
      // printData('decreaseApproval - error', error);
      assert.equal(true, true);
    }
  });

});





describe('The Lightsteam Token when not paused', ()=> {
  it('The owner can unpause the token', async ()=> {
    await lightstreamTokenContract.methods.unpause().send({from: accounts[0], gas: '4712388'});

    const paused = await lightstreamTokenContract.methods.paused().call();
    printData('paused', paused);
    assert.equal(false, paused);
  });

  // mint(address _to, uint256 _amount)
  it('Minting should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.mint(accounts[1], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      printData('Minting - error', error);
      assert.equal(false, true);
    }
  });

  // function transfer(address _to, uint256 _value)
  it('transfer should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.transfer(accounts[1], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      assert.equal(false, true);
    }
  });


  // function transferFrom(address _from, address _to, uint256 _value)
  it('transferFrom should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.transferFrom(accounts[0], accounts[9], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      assert.equal(false, true);
    }
  });

  // function approve( address _spender, uint256 _value)
  it('approve should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.approve(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      assert.equal(false, true);
    }
  });

  // function increaseApproval( address _spender, uint _addedValue)
  it('increaseApproval should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.increaseApproval(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      assert.equal(false, true);
    }
  });

  // function decreaseApproval(address _spender, uint _subtractedValue)
  it('decreaseApproval should work when the token is not paused', async ()=> {
    try {
      await lightstreamTokenContract.methods.increaseApproval(accounts[3], transferOrMintAmount).send({from: accounts[0], gas: '4712388'});
      assert.equal(true, true);
    } catch(error){
      assert.equal(false, true);
    }
  });

});