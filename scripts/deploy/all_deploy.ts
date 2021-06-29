const hre = require("hardhat");

const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { POOLS_PARAMS, TOKENS, DELEGATOR_NAMES } = require(param_file_path);

let pools: String[] = [];
let tokens: String[] = [];
let underlyings: String[] = [];

let delegators: { [name: string]: string } = {};

let palPools: { [name: string]: {[name: string]: string} } = {};

async function main() {

  const deployer = (await hre.ethers.getSigners())[0];
  


  const Controller = await ethers.getContractFactory("PaladinController");
  const Interest = await ethers.getContractFactory("InterestCalculator");
  const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
  const Registry = await ethers.getContractFactory("AddressRegistry");
  const PalPool = await ethers.getContractFactory("PalPool");
  const PalToken = await ethers.getContractFactory("PalToken");

  //variant pools :
  const stkAavePalPool = await ethers.getContractFactory("PalStkAave");



  console.log('Deploying the Paladin Controller ...')
  const controller = await Controller.deploy();

  console.log('Deploying the Interest Calculator Module ...')
  const interest = await Interest.deploy();

  

  await Promise.all([
    controller.deployed(),
    interest.deployed(),
  ]);



  console.log('Deploying PalLoanToken (ERC721) contract ...')
  const loanToken = await PalLoanToken.deploy(controller.address);
  await loanToken.deployed();



  for(let d in DELEGATOR_NAMES){
    let Delegator = await ethers.getContractFactory(DELEGATOR_NAMES[d]);
    console.log('Deploying Delegator ' + DELEGATOR_NAMES[d] + ' ...')
    const delegator = await Delegator.deploy();
    await delegator.deployed();

    delegators[d] = delegator.address;
  }



  for(let p in POOLS_PARAMS){
    let params = POOLS_PARAMS[p];

    console.log('Deploying PalToken ' + params.SYMBOL + ' ...')
    let palToken = await PalToken.deploy(params.NAME, params.SYMBOL);
    await palToken.deployed();


    let palPool;
    console.log('Deploying PalPool ' + params.SYMBOL + ' ...')
    if(params.SYMBOL === 'palStkAAVE'){
      palPool = await stkAavePalPool.deploy(
        palToken.address,
        controller.address,
        params.UNDERLYING,
        interest.address,
        delegators[params.DELEGATOR],
        loanToken.address,
        TOKENS.AAVE
      );
    }
    else{
      palPool = await PalPool.deploy(
        palToken.address,
        controller.address,
        params.UNDERLYING,
        interest.address,
        delegators[params.DELEGATOR],
        loanToken.address
      );
    }
    await palPool.deployed();

    await palToken.initiate(palPool.address)


    pools.push(palPool.address)
    tokens.push(palToken.address)
    underlyings.push(params.UNDERLYING)

    palPools[p] = {
      'pool': palPool.address,
      'token': palToken.address,
      'symbol': params.SYMBOL
    }
  }



  await controller.setInitialPools(tokens, pools);



  console.log('Deploying the Address Registry ...')
  const registry = await Registry.deploy(
    controller.address,
    loanToken.address,
    underlyings,
    pools,
    tokens
  );
  await registry.deployed





  await controller.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: controller.address,
    constructorArguments: [],
  });
  console.log()
  await interest.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: interest.address,
    constructorArguments: [],
  });
  console.log()
  await loanToken.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: loanToken.address,
    constructorArguments: [controller.address],
  });
  console.log()
  await registry.deployTransaction.wait(5);
  await hre.run("verify:verify", {
    address: registry.address,
    constructorArguments: [
      controller.address,
      loanToken.address,
      underlyings,
      pools,
      tokens
    ],
  });
  console.log()
  for(let p in palPools){
    await hre.run("verify:verify", {
      address: palPools[p]['token'],
      constructorArguments: [
        POOLS_PARAMS[p].NAME,
        POOLS_PARAMS[p].SYMBOL
      ],
    });
    console.log()
    if(palPools[p]['symbol'] === 'palStkAAVE'){
      await hre.run("verify:verify", {
        address: palPools[p]['pool'],
        constructorArguments: [
          palPools[p]['token'],
          controller.address,
          POOLS_PARAMS[p].UNDERLYING,
          interest.address,
          delegators[POOLS_PARAMS[p].DELEGATOR],
          loanToken.address,
          TOKENS.AAVE
        ],
      });
      console.log()
    }
    else{
      await hre.run("verify:verify", {
        address: palPools[p]['pool'],
        constructorArguments: [
          palPools[p]['token'],
          controller.address,
          POOLS_PARAMS[p].UNDERLYING,
          interest.address,
          delegators[POOLS_PARAMS[p].DELEGATOR],
          loanToken.address
        ],
      });
      console.log()
    }
  }

  console.log('Controller : ')
  console.log(controller.address)
  console.log()
  console.log('Interest Calculator : ')
  console.log(interest.address)
  console.log()
  console.log('PalLoanToken : ')
  console.log(loanToken.address)
  console.log()
  console.log('Address Registry : ')
  console.log(registry.address)
  console.log()
  for(let d in delegators){
    console.log(DELEGATOR_NAMES[d] + ' : ')
    console.log(delegators[d])
  }
  console.log()
  for(let p in palPools){
    console.log(palPools[p]['symbol'])
    console.log('PalPool :  ' + palPools[p]['pool'])
    console.log('PalToken :  ' + palPools[p]['token'])
  }

}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });