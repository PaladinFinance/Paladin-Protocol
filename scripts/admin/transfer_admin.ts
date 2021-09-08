export { };
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { CONTROLLER, PAL_LOAN_TOKEN, ADDRESS_REGISTRY, INTEREST_MODULE_V2, POOLS } = require(param_file_path);

const PalPool = require("../../artifacts/contracts/interfaces/IPalPool.sol/IPalPool.json");


const new_admin = ''


async function main() {

    const provider = ethers.provider;

    console.log('Transfer admin of contracts to ', new_admin)

    const admin = (await hre.ethers.getSigners())[0];

    const Controller = await ethers.getContractFactory("PaladinController");
    const Registry = await ethers.getContractFactory("AddressRegistry");
    const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
    const Interest = await ethers.getContractFactory("InterestCalculatorV2");

    const controller = Controller.attach(CONTROLLER);
    const registry = Registry.attach(ADDRESS_REGISTRY);
    const loanToken = PalLoanToken.attach(PAL_LOAN_TOKEN);
    const interest = Interest.attach(INTEREST_MODULE_V2);


    await controller.setNewAdmin(new_admin)
    await registry.setNewAdmin(new_admin)
    await loanToken.setNewAdmin(new_admin)
    await interest.setNewAdmin(new_admin)


    console.log('Updating all Pools admin ... ')
    for (let p in POOLS) {
        let pool_data = POOLS[p];

        let pool = new ethers.Contract(pool_data.POOL, PalPool.abi, provider);

        await pool.setNewAdmin(new_admin)
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