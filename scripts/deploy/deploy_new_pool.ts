export {};
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { POOLS_PARAMS, TOKENS, DELEGATORS, CONTROLLER, INTEREST_MODULE, PAL_LOAN_TOKEN } = require(param_file_path);


const NAME = ''


async function main() {

  const deployer = (await hre.ethers.getSigners())[0];

  const PalPool = await ethers.getContractFactory("PalPool");
  const PalToken = await ethers.getContractFactory("PalToken");

  //variant pools :
  const stkAavePalPool = await ethers.getContractFactory("PalStkAave");

  
  
  const params = POOLS_PARAMS[NAME];

  console.log('Deploying PalToken ' + params.SYMBOL + ' ...')
  const palToken = await PalToken.deploy(params.NAME, params.SYMBOL);
  await palToken.deployed();


  let palPool;
  console.log('Deploying PalPool ' + params.SYMBOL + ' ...')
  if(params.SYMBOL === 'palStkAAVE'){
    palPool = await stkAavePalPool.deploy(
      palToken.address,
      CONTROLLER,
      params.UNDERLYING,
      INTEREST_MODULE,
      DELEGATORS[params.DELEGATOR],
      PAL_LOAN_TOKEN,
      TOKENS.AAVE
    );
  }
  else{
    palPool = await PalPool.deploy(
      palToken.address,
      CONTROLLER,
      params.UNDERLYING,
      INTEREST_MODULE,
      DELEGATORS[params.DELEGATOR],
      PAL_LOAN_TOKEN
    );
  }
  await palPool.deployed();


  await palToken.initiate(palPool.address)


  await hre.run("verify:verify", {
    address: palToken.address,
    constructorArguments: [
      POOLS_PARAMS[NAME].NAME,
      POOLS_PARAMS[NAME].SYMBOL
    ],
  });
  console.log()
  if(POOLS_PARAMS[NAME].SYMBOL === 'palStkAAVE'){
    await hre.run("verify:verify", {
      address: palPool.address,
      constructorArguments: [
        palToken.address,
        CONTROLLER,
        params.UNDERLYING,
        INTEREST_MODULE,
        DELEGATORS[params.DELEGATOR],
        PAL_LOAN_TOKEN,
        TOKENS.AAVE
      ],
    });
  }
  else{
    await hre.run("verify:verify", {
      address: palPool.address,
      constructorArguments: [
        palToken.address,
        CONTROLLER,
        params.UNDERLYING,
        INTEREST_MODULE,
        DELEGATORS[params.DELEGATOR],
        PAL_LOAN_TOKEN
      ],
    });
  }

  console.log('PalPool :  ' + palPool.address)
  console.log('PalToken :  ' + palToken.address)

  console.log("(the new PalPool will need to be listed in the Paladin Controller)")
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
