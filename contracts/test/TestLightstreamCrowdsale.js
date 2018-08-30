let LightstreamToken = artifacts.require("LightstreamToken");
let TeamDistribution = artifacts.require("distribution/TeamDistribution");
let LightstreamCrowdsale = artifacts.require("LightstreamCrowdsale");


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


contract('LightstreamToken', async (accounts)=> {
  it('should deploy the token and store the address', async ()=> {
    const tokenInstance = await LightstreamToken.deployed();

    assert(tokenInstance.address, 'Token address couldn\'t be stored');
  });

  it('should transfer the ownership to the crowdsale contract', async ()=> {
      const instance = await LightstreamToken.deployed();
      const data = await instance.transferOwnership(LightstreamCrowdsale.address);
      const owner = await instance.owner();

      assert.equal(LightstreamCrowdsale.address, owner);
  });

});


contract('Team Distribution', async (accounts)=> {
  it('should deploy the Team Distribution contract and store the address', async ()=>{
    const teamInstance = await TeamDistribution.deployed();

    assert(teamInstance.address, 'Token address couldn\'t be stored');
  });

  it('When finalize is called on the sales contract the team contract gets 135 million PTH', async ()=>{
    const crowdsalesInstance = await LightstreamCrowdsale.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const data = await tokenInstance.transferOwnership(LightstreamCrowdsale.address);

    const timeTravelTransaction = await timeTravel(3600 * 24 * 32); // Travel 32 days into the future for testing
    const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336

    const closingTime = await crowdsalesInstance.closingTime.call();
    const hasClosed = await crowdsalesInstance.hasClosed.call();
    const returnTimestamp = await crowdsalesInstance.returnTimestamp.call();

    const finalize = await crowdsalesInstance.finalize({from: accounts[0]});
    const balance = await tokenInstance.balanceOf(TeamDistribution.address);
    console.log(balance.c[0]);

    const number = web3._extend.utils.fromWei('15424000', 'ether');

    assert(balance.c[0], 1350000000000);
  });

  it('The owner can create an allocation from the team supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('5424000', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[2], PHT, 0);
    const allocation = await teamInstance.allocations(accounts[2]);
    const teamSupply = await teamInstance.AVAILABLE_TEAM_SUPPLY.call();
    console.log(allocation[4].c[0]);
    assert.equal(allocation[4].c[0], 54240000000);
  });

  it('The only the owner can create an allocation from the team supply', async ()=> {
    try {
      const teamInstance = await TeamDistribution.deployed();
      const PHT = web3._extend.utils.toWei('5424000', 'ether');

      const transaction = await teamInstance.setAllocation(accounts[2], PHT, 0, {from: accounts[2]});

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });

  it('The owner can not create an allocation for an address that already has an allocation', async ()=> {
    try {
      const teamInstance = await TeamDistribution.deployed();
      const PHT = web3._extend.utils.toWei('5424000', 'ether');

      const transaction = await teamInstance.setAllocation(accounts[2], PHT, 0);
      const allocation = await teamInstance.allocations(accounts[2]);
      const teamSupply = await teamInstance.AVAILABLE_TEAM_SUPPLY.call();

      assert(false, true);
    } catch(error){
      assert(error);
    }
  });


  it('The owner can create an allocation from the seed investors supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('6000000', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[4], PHT, 1);
    const allocation = await teamInstance.allocations(accounts[4]);
    const seedInvestorSupply = await teamInstance.AVAILABLE_SEED_INVESTORS_SUPPLY.call();
    console.log('seedInvestorSupply', seedInvestorSupply);

    assert.equal(allocation[4].c[0], 60000000000);
  });

  it('The owner can create an allocation from the founders supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const PHT = web3._extend.utils.toWei('5000000', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[5], PHT, 2);
    const allocation = await teamInstance.allocations(accounts[5]);
    const foundersSupply = await teamInstance.AVAILABLE_FOUNDERS_SUPPLY.call();

    assert.equal(allocation[4].c[0], 50000000000);
  });

  it('The owner can create an allocation from the advisors supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('2100', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[6], PHT, 3);
    const allocation = await teamInstance.allocations(accounts[6]);
    const advisorsSupply = await teamInstance.AVAILABLE_ADVISORS_SUPPLY.call();
    const advisorAccountBalance = await tokenInstance.balanceOf(accounts[6]);

    console.log(advisorAccountBalance);

    assert.equal(advisorAccountBalance.c[0], 21000000);
  });

  it('The owner can create an allocation from the consultants supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('1300', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[7], PHT, 4);
    const allocation = await teamInstance.allocations(accounts[7]);
    const foundersSupply = await teamInstance.AVAILABLE_CONSULTANTS_SUPPLY.call();
    const consultantAccountBalance = await tokenInstance.balanceOf(accounts[7]);

    console.log(consultantAccountBalance);

    assert.equal(consultantAccountBalance.c[0], 13000000);
  });

  it('The owner can create an allocation from the others supply', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();
    const PHT = web3._extend.utils.toWei('1300', 'ether');

    const transaction = await teamInstance.setAllocation(accounts[8], PHT, 5);
    const allocation = await teamInstance.allocations(accounts[8]);
    const foundersSupply = await teamInstance.AVAILABLE_CONSULTANTS_SUPPLY.call();
    const othersAccountBalance = await tokenInstance.balanceOf(accounts[8]);

    console.log(othersAccountBalance);

    assert.equal(othersAccountBalance.c[0], 13000000);
  });

  it('The team memeber can release their vested amount', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const nowBefore = await teamInstance.returnNow.call();
    console.log('nowBefore', nowBefore);


    const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 30); // Travel 3 months into the future for testing
    await mineBlock();

    const nowAfter = await teamInstance.returnNow.call();
    console.log('nowAfter', nowAfter);
    const allocation = await teamInstance.allocations(accounts[2]);
    console.log(allocation);
    const released = await teamInstance.release(accounts[2], {from: accounts[2]});

    const teamMemeberAccountBalance = await tokenInstance.balanceOf(accounts[2]);

    console.log(teamMemeberAccountBalance);

    //assert.equal(teamMemeberAccountBalance, 13000000);
  });

  it('The someone other than the team memeber can not release the vested amount', async ()=> {
    const teamInstance = await TeamDistribution.deployed();

    const nowBefore = await teamInstance.returnNow.call();
    console.log('nowBefore', nowBefore);
    try {
      const released = await teamInstance.release(accounts[2], {from: accounts[3]});
    } catch (error){
      assert(error);
    }
  });

  it('The the owner can revoke a team memeber\'s vesting', async ()=> {
    const teamInstance = await TeamDistribution.deployed();
    const tokenInstance = await LightstreamToken.deployed();

    const nowBefore = await teamInstance.returnNow.call();
    const otherBalance = await teamInstance.AVAILABLE_OTHER_SUPPLY.call();
    console.log('otherBalance', otherBalance);
    const released = await teamInstance.revokeAllocation(accounts[2]);

    const otherBalanceAfter = await teamInstance.AVAILABLE_OTHER_SUPPLY.call();
    console.log('otherBalanceAfter', otherBalanceAfter);
    const teamMemberBalance = await tokenInstance.balanceOf(accounts[2]);
    console.log('teamMemberBalance', teamMemberBalance);

  });

  it('The only the owner can revoke a team memeber\'s vesting', async ()=> {
    const teamInstance = await TeamDistribution.deployed();

    const nowBefore = await teamInstance.returnNow.call();
    console.log('nowBefore', nowBefore);
    try {
      const released = await teamInstance.revokeAllocation(accounts[2], {from: accounts[3]});
    } catch (error){
      assert(error);
    }
  });


});





//
//
// contract('LightstreamCrowdsale', function(accounts) {
//   it('should deploy the Lightstream Crowdsale contract and store the address', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       assert(instance.address, 'Token address couldn\'t be stored');
//       done();
//     });
//   });
//
//   it('The owner should be able to add an address to the whitelist', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       const transaction = await instance.addAddressToWhitelist(accounts[1], {from: accounts[0]});
//       const whitelisted = await instance.whitelist(accounts[1]);
//       console.log('whitelisted', whitelisted);
//       assert(whitelisted);
//       done();
//     });
//   });
//
//   it('A whitelisted address should be able to purchase tokens', function(done){
//     LightstreamCrowdsale.deployed().then(async function(instance) {
//       const etherInWei = web3._extend.utils.toWei(1, 'ether');
//       const weiBigNumber = web3._extend.utils.toBigNumber(etherInWei);
//
//       try {
//         const timeTravelPromise = await timeTravel(36 * 60 * 60);
//         const mineBlockPromise = await mineBlock();
//         const now = await instance.returnNow.call();
//         const startTime = await instance.openingTime.call();
//
//         console.log('sta', startTime);
//         console.log('now', now);
//         const transaction = await instance.buyTokens(accounts[1], { from: accounts[1], value: weiBigNumber });
//
//       } catch(error){
//         console.log('timeTravelPromise', error);
//       }
//
//       done();
//     });
//   });
//
// });


// before(async()=> {
//   LightstreamCrowdsale.deployed().then(async function(instance) {
//   // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
//   try {
//     const closingTime = await instance.closingTime.call();
//     const hasClosed = await instance.hasClosed.call();
//     const returnTimestamp = await instance.returnTimestamp.call();
//     console.log('closingTime         ', closingTime);
//     console.log('returnTimestampBefor', returnTimestamp);
//     console.log('hasClosed           ', hasClosed);
//
//     const timeTravelTransaction = await timeTravel(3600 * 24 * 30 * 3); // Travel three months into the future for testing
//     const mineBlockTransaction = await mineBlock(); // workaround for https://github.com/ethereumjs/testrspc/issues/336
//
//     const returnTimestampAfter = await instance.returnTimestamp.call();
//     const hasClosedAfter = await instance.hasClosed.call();
//     const closingTimeAfter = await instance.closingTime.call();
//     console.log('closingTimeAfter    ', closingTimeAfter);
//     console.log('returnTimestampAfter', returnTimestampAfter);
//     console.log('hasClosedAfter      ', hasClosed);
//     const owner = await instance.owner.call();
//     console.log('owner', owner);
//     console.log('acct0', accounts[0]);
//
//     // finalaize the sale which will mint the tokens and delilver them to the Team Distribution Contract
//     const finalize = await instance.finalize({from: accounts[0]});
//     console.log(finalize);
//     const mineAgain = await mineBlock();
//   } catch(error){
//     console.log('finalize -- error', error);
//   }
// });
// });