export {};
const hre = require("hardhat");

const ethers = hre.ethers;

const network = hre.network.name;

const params_path = () => {
  if (network === 'kovan') {
    return '../utils/kovan_params'
  }
  else if (network === 'rinkeby') {
    return '../utils/rinkeby_params'
  }
  else {
    return '../utils/main_params'
  }
}

const param_file_path = params_path();

const { MULTIPLIERS, INTEREST_MODULE_VALUES } = require(param_file_path);

let pools: String[] = [];
let multipliers: String[] = [];

async function main() {

    console.log('Deploying the Interest Calculator V2 Module ...')

    const deployer = (await hre.ethers.getSigners())[0];

    const Interest = await ethers.getContractFactory("InterestCalculatorV2");

    const interest = await Interest.deploy();
    await interest.deployed();

    for(let m in MULTIPLIERS){
        for(let p in MULTIPLIERS[m].POOLS){
            multipliers.push(MULTIPLIERS[m].ADDRESS)
            pools.push(MULTIPLIERS[m].POOLS[p])
        }
    }

    await interest.initiate(
        INTEREST_MODULE_VALUES.MULTIPLIER_PER_YEAR,
        INTEREST_MODULE_VALUES.BASE_RATE_PER_YEAR,
        INTEREST_MODULE_VALUES.JUMP_MULTIPLIER_PER_YEAR,
        pools,
        multipliers
    )


    console.log('Interest Calculator : ')
    console.log(interest.address)

    await interest.deployTransaction.wait(5);
  
    await hre.run("verify:verify", {
      address: interest.address,
      constructorArguments: [],
    });
}


main()
.then(() => {
    process.exit(0);
})
.catch(error => {
    console.error(error);
    process.exit(1);
});