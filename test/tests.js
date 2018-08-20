require('events').EventEmitter.prototype._maxListeners = 100;
const assert = require('chai').assert;
const ganche = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganche.provider());
const path = require('path');
const fs = require('fs');

// Lightsteam Token Contract
const lightstreamTokenPath = path.resolve(__dirname, '../contracts/build/contracts', 'LightstreamToken.json');
const lightstreamTokenJSON = fs.readFileSync(lightstreamTokenPath, 'utf8');
const { abi: lightstreamTokenAbi, bytecode: lightstreamTokenBytecode } = JSON.parse(lightstreamTokenJSON);

// Sample Crowdsale Contract
const lightstreamCrowdsalePath = path.resolve(__dirname, '../contracts/build/contracts', 'LightstreamCrowdsale.json');
const lightstreamCrowdsaleJSON = fs.readFileSync(lightstreamCrowdsalePath, 'utf8');
const { abi: lightstreamCrowdsaleAbi, bytecode: lightstreamCrowdsaleBytecode } = JSON.parse(lightstreamCrowdsaleJSON);

// Monthly Token Vesting
const tokenVestingPath = path.resolve(__dirname, '../contracts/build/contracts', 'MonthlyTokenVesting.json');
const tokenVestingJSON = fs.readFileSync(tokenVestingPath, 'utf8');
const { abi: tokenVestingAbi, bytecode: tokenVestingBytecode } = JSON.parse(tokenVestingJSON);

// Distribution Contract
const teamDistributionPath = path.resolve(__dirname, '../contracts/build/contracts', 'TeamDistribution.json');
const teamDistributionJSON = fs.readFileSync(teamDistributionPath, 'utf8');
const { abi: teamDistributionAbi, bytecode: teamDistributionBytecode } = JSON.parse(teamDistributionJSON);


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
let distributionContract;
let distributionContractAddress;
let vestingContact;
let vestingContractAddress;
let sampleCrowdsaleContract;
let timeOffset = 3600 * 24 * 30; // 30 days
let startTime = Math.floor(new Date().getTime() /1000 + (3600 * 24));;
let endTime= startTime + timeOffset;
let walletAdress;

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

  // Deploy the distribution Contract
  distributionContract = await new web3.eth.Contract(teamDistributionAbi)
    .deploy({ data: teamDistributionBytecode, arguments: [startTime.toString(), lightstreamTokenAddress]})
    .send({ from: accounts[0], gas: '4712388' });

  distributionContractAddress = distributionContract.options.address;

  // Convert 1 Ether to Wei and convert to Big Number format
  const etherInWei = web3.utils.toWei('1', 'ether');
  const bigNumber = web3.utils.toBN(etherInWei);

  // Deploy Crowdsale Contract with constructor arguments Start Time, End Time, Ratio of PTH to ETH, Wallet for funds to be deposited, Max Cap in ETH, and Address of Lightingstream Token
    sampleCrowdsaleContract = await new web3.eth.Contract(lightstreamCrowdsaleAbi)
      .deploy({ data: lightstreamCrowdsaleBytecode, arguments: [startTime.toString(), endTime.toString(), '1', walletAdress, bigNumber, lightstreamTokenAddress, distributionContractAddress]})
      .send({ from: accounts[0], gas: '4712388' });

    // Transfer ownership to the crowdsale contract so only it can mint tokens
    await lightstreamTokenContract.methods.transferOwnership(sampleCrowdsaleContract.options.address).send({ from: accounts[0], gas: '4712388' });
});

/*
 * Tests to that the Lightstream Token and Whitelisted Crowdsale Contracts were deployed and have an address
 */

describe('The contacts are deployed', ()=> {
  it('deploys a Lightstream Token Contract', ()=> {
    assert.ok(lightstreamTokenContract.options.address);
  });

  it('deploys a Whitelisted Crowdsale Contract', ()=> {
    assert.ok(sampleCrowdsaleContract.options.address);
  });

  it('deploys a Distribution Contract', ()=> {
    assert.ok(distributionContract.options.address);
  });
});

/*
 * Tests the owners ability to add and remove whitelisted addresses found in the Whitelist.sol contract
 */

describe('Tests the Whitelist.sol contract functionality', ()=> {
  // addAddressToWhitelist - addAddressToWhitelist(address)
  it('Allows the owner to add an address to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[2]).send({ from: accounts[0], gas: '4712388' });
  });

  // addAddressesToWhitelist(address[])
  it('Allows the owner to add multiple addresses to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.addAddressesToWhitelist([accounts[3], accounts[4], accounts[5]]).send({ from: accounts[0], gas: '4712388' });
  });

  // whitelist(address)
  it('Returns True if the Owner checks to see if a previously added address has been whitelisted', async ()=> {
    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[3]).call();
    assert.equal(response, true);
  });

  // whitelist - whitelist(address)
  it('Returns False if the Owner checks an address not added to the whitelisted', async ()=> {
    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[9]).call();
    assert.equal(response, false);
  });

  // removeAddressFromWhitelist(address)
  it('Allows the owner to remove an address that has already been added to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.removeAddressFromWhitelist(accounts[2]).send({ from: accounts[0], gas: '4712388' });

    const response = await sampleCrowdsaleContract.methods.whitelist(accounts[2]).call();

    assert.equal(response, false);
  });

  // removeAddressesFromWhitelist(address[])
  it('Allows the owner to remove several addresses that have already been added to the whitelist', async ()=> {
    await sampleCrowdsaleContract.methods.removeAddressesFromWhitelist([accounts[3], accounts[4], accounts[5]]).send({ from: accounts[0], gas: '4712388' });

    const response1 = await sampleCrowdsaleContract.methods.whitelist(accounts[3]).call();
    const response2 = await sampleCrowdsaleContract.methods.whitelist(accounts[4]).call();
    const response3 = await sampleCrowdsaleContract.methods.whitelist(accounts[5]).call();

    assert.equal(response1, false);
    assert.equal(response2, false);
    assert.equal(response3, false);
  });

});

/*
 * Tests retrieving the token cap and if the cap has been reached in the TokenCappedCrowdsale.sol contract
 */

describe('Tests the TokenCappedCrowdsale.sol functionality', async ()=> {
  // cap()
  it('Returns the cap amount when the crowdsale contract was deployed', async ()=> {
    const tokenCap = await sampleCrowdsaleContract.methods.tokenCap().call();

    printData('tokenCap', tokenCap);
    assert.equal(165000000000000000000000000, tokenCap);
  });

  // capReached()
  it('Returns False if the cap amount has not been reached yet', async ()=> {
    const response = await sampleCrowdsaleContract.methods.capReached().call();

    assert.equal(false, response);
  });

});

/*
 * Tests retrieving the openingTime, closingTime, and hasClosed functions in the TimedCrowdsale.sol contract
 */

describe("Tests the TimedCrowdsale.sol functionality", async ()=> {
  // openingTime()
  it('Returns the opening time timestamp in epoch format from when the contract was initialized', async ()=> {
    const response = await sampleCrowdsaleContract.methods.openingTime().call();

    assert.equal(startTime, response);
  });

  // closingTime()
  it('Returns the closing time timestamp in epoch format from when the contract was initialized', async ()=> {
    const response = await sampleCrowdsaleContract.methods.closingTime().call();

    assert.equal(endTime, response);
  });

  // hasClosed()
  it('Returns false if the crowdsale has not reached it\'s closing time', async ()=> {
    const response = await sampleCrowdsaleContract.methods.hasClosed().call();

    assert.equal(false, response);
  });

});

/*
 * Tests retrieving the token, owner, wallet, rate, weiRaised, and buying of tokens in the Crowdsale.sol contract
 */

describe("Tests the Crowdsale.sol functionality", async ()=> {
  // token()
  it('Returns the tokens address', async ()=> {
    const tokenAddress = await sampleCrowdsaleContract.methods.token().call();

    assert.equal(lightstreamTokenAddress, tokenAddress);
  });

  // owner()
  it('Returns the owners address', async ()=> {
    const ownerAddress = await sampleCrowdsaleContract.methods.owner().call();

    assert.equal(accounts[0], ownerAddress);
  });

  // wallet()
  it('Returns the wallet adddress', async ()=> {
    const returnedWalletAdress = await sampleCrowdsaleContract.methods.wallet().call();

    assert.equal(walletAdress, returnedWalletAdress)
  });

  // rate()
  it('Returns the rate information', async ()=> {
    const rate = await sampleCrowdsaleContract.methods.rate().call();

    assert.equal(2733000000000000000000, rate);
  });

  // buyTokens(address)
  it('Allows for purchase of newly created token', async ()=> {
    // Travel ahead two days so the sale is open
    await timeTravel(3600 * 24 * 2);

    // convert ether to a Big Number so web3 doesn't complain
    const etherInWei = web3.utils.toWei('1', 'ether');
    const purchaseAmount = web3.utils.toBN(etherInWei);

    try {
      await sampleCrowdsaleContract.methods.addAddressToWhitelist(accounts[1]).send({ from: accounts[0], gas: '4712388' });

      const isWhitelisted = await sampleCrowdsaleContract.methods.whitelist(accounts[1]).call();
      printData('isWhitelisted', isWhitelisted);

      await sampleCrowdsaleContract.methods.buyTokens(accounts[1]).send({ from: accounts[1], value: purchaseAmount, gas: '4712388' });

    } catch(error){
      printData('error', error);
    }
  });

  // weiRaised()
  it('Returns the the amount of Wei raised', async ()=> {
    const weiRaised = await sampleCrowdsaleContract.methods.weiRaised().call();

    assert.equal(1000000000000000000, weiRaised);
  });

  // ownerAddressToVestingContractAddress(address)
  it("Returns the vesting contract address of the beneficiary", async ()=> {
    vestingContractAddress = await sampleCrowdsaleContract.methods.ownerAddressToVestingContractAddress(accounts[1]).call();
  });

});


/*
 * Tests retrieving the token, owner, wallet, rate, weiRaised, and buying of tokens in the Crowdsale.sol contract
 */

describe("Test TokenVesting.sol functionality", async ()=> {
  let releaseableAmount;

  before(async ()=> {
    // create an instance of the vesting contract with the vesting contract address
    vestingContact = new web3.eth.Contract(tokenVestingAbi, vestingContractAddress);

    // Travel three months into the future for testing
    timeTravel(3600 * 24 * 30 * 3);

    await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
  });

  // releasableAmount()
  it('The vesting contract returns the releaseable Amount', async ()=> {
    releaseableAmount = await vestingContact.methods.releasableAmount().call();
  });

  // vestedAmount
  it('Returns the vestedAmount', async ()=> {
    const vestedAmount = await vestingContact.methods.vestedAmount().call();
  });

  // startTimestamp
  it('Returns the startTimestamp', async ()=> {
    const startTimestamp = await vestingContact.methods.startTimestamp().call();
    assert.equal(1535760000, startTimestamp);
  });

  // startTimestamp
  it('Returns the endTimestamp', async ()=> {
    const endTimestamp = await vestingContact.methods.endTimestamp().call();
    assert.equal(1551312000, endTimestamp);
  });

  // lockPeriod
  it('Returns the lockPeriod', async ()=> {
    const lockPeriod = await vestingContact.methods.lockPeriod().call();
    assert.equal(2592000, lockPeriod);
  });

  // release
  it('The releases the amount vested', async ()=> {
    try{
      const release = await vestingContact.methods.release().send({ from: accounts[1], gas: '4712388' });
    } catch(error) {
      printData('error', error);
    }
  });

  // released
  it('The released', async ()=> {
    const released = await vestingContact.methods.released().call();
    printData('released', released);
  });
});


/*
 * Tests the team distribution contract for setting, and revoking allocations
 */

describe("Tests the distribution contract", async ()=> {
  let vestingContractAddress;

  before(async()=>{
    await sampleCrowdsaleContract.methods.finalize().send({ from: accounts[0], gas: '4712388' });

    await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
  });

  it("Has the Lightstream token in it", async ()=> {
    const balance = await lightstreamTokenContract.methods.balanceOf(distributionContractAddress).call();
  });

  // setAllocation (address _beneficiary, uint256 _totalAllocated, AllocationType _supply)
  it("Is able to set an allocation", async ()=> {

    // Convert PTH to Big Number format
    const PHT = web3.utils.toWei('15424000', 'ether');
    const phtBigNumber = web3.utils.toBN(PHT);

    try {
      const owner = await distributionContract.methods.owner().call();
      printData('distributionContract', owner);
      printData('startTime', startTime);
     const allocation = await distributionContract.methods.setAllocation(accounts[4], phtBigNumber, 0).send({ from: accounts[0], gas: '4712388' });
      //printData('allocation', allocation);
    } catch(error){
      printData('Error - Is able to set an allocation', error);
    }
  });

  it("Returns the address of the vesting contract for the investors address", async ()=> {
    vestingContractAddress = await distributionContract.methods.ownerAddressToVestingContractAddress(accounts[4]).call();
    printData('vestingContractAddress', vestingContractAddress);
  });

  it("Returns the balance for the team supply", async ()=> {
    const teamSupply = await distributionContract.methods.AVAILABLE_TEAM_SUPPLY().call();
    printData('teamSupply', teamSupply);
  });

  // revoke (address _beneficiary)
  it("Is able to revoke an allocation", async ()=> {
    await timeTravel(3600 * 24 * 30 * 5);

    await mineBlock();

    const distributionVestingContact = new web3.eth.Contract(tokenVestingAbi, vestingContractAddress);
    const vestingOwner = await distributionVestingContact.methods.owner().call();
    const revocable = await distributionVestingContact.methods.revocable().call();
    const releasableAmount = await distributionVestingContact.methods.releasableAmount().call();
    const vestedAmount = await distributionVestingContact.methods.vestedAmount().call();
    const vestingTokenBalance = await lightstreamTokenContract.methods.balanceOf(vestingContractAddress).call();

    printData('vestingOwner', vestingOwner);
    printData('revokable', revocable);
    printData('releasableAmount', releasableAmount);
    printData('vestedAmount', vestedAmount);
    printData('vestingTokenBalance', vestingTokenBalance);
    printData('distributionContract', distributionContract.options.address);

    try {
      const revoke = await distributionVestingContact.methods.revoke().send({ from: accounts[0], gas: '4712388' });

      //printData('revoke', revoke);
    } catch(error){
      printData('Error - revokeAllocation', error);
    }
  });


});


/*
 * Tests the distribution of PTH and ETH to the beneficiary, and investor's wallet
 */

describe("The investors's wallet", async ()=> {
  it("Has the right amount of the Lightstream token in it", async ()=> {
    const lightstreamBalance = await lightstreamTokenContract.methods.balanceOf(accounts[1]).call();

    assert.equal(911000000000000000000000000000000000000, lightstreamBalance);
  });
});

describe("The beneficiary's wallet", async ()=> {
  it("Has the correct amount of ETH in it", async ()=> {
    const ethBalance = await web3.eth.getBalance(accounts[9]);

    assert.equal(101000000000000000000, ethBalance);
  });
});















//   'checkRole(address,string)'
//   'ROLE_WHITELISTED()' 
//   'hasRole(address,string)' 
//   'renounceOwnership()'

