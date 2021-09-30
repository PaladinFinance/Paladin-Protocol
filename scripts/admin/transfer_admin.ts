export { };
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

const { CONTROLLER, PAL_LOAN_TOKEN, ADDRESS_REGISTRY, INTEREST_MODULE_V2, POOLS } = require(param_file_path);


const new_admin = ""


async function main() {

    if(!new_admin){
        console.log('No admin address given')
        process.exit(1);
    }

    const provider = ethers.provider;

    console.log('Transfer admin of contracts to ', new_admin)

    const admin = (await hre.ethers.getSigners())[0];

    let tx;

    const Controller = await ethers.getContractFactory("PaladinController");
    const Registry = await ethers.getContractFactory("AddressRegistry");
    const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
    const Interest = await ethers.getContractFactory("InterestCalculatorV2");
    const Pool = await ethers.getContractFactory("PalPool");

    const controller = Controller.attach(CONTROLLER);
    const registry = Registry.attach(ADDRESS_REGISTRY);
    const loanToken = PalLoanToken.attach(PAL_LOAN_TOKEN);
    const interest = Interest.attach(INTEREST_MODULE_V2);


    tx = await controller.setNewAdmin(new_admin)

    await tx.wait(10)

    tx = await registry.setNewAdmin(new_admin)

    await tx.wait(10)

    tx = await loanToken.setNewAdmin(new_admin)

    await tx.wait(10)

    tx = await interest.setNewAdmin(new_admin)

    await tx.wait(10)


    console.log('Updating all Pools admin ... ')
    for (let p in POOLS) {
        let pool_data = POOLS[p];

        let pool = Pool.attach(pool_data.POOL);

        tx = await pool.setNewAdmin(new_admin)

        await tx.wait(10)

    }

    console.log('Admin transfer done ')

}


main()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });