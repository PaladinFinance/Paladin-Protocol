export {};
const hre = require("hardhat");
const ethers = hre.ethers;

const network = hre.network.name;
const param_file_path = network === 'kovan' ? '../utils/kovan_params' : '../utils/main_params'

const { PAL_LOAN_TOKEN, ADDRESS_REGISTRY, CONTROLLER, POOLS } = require(param_file_path);

let pools: String[] = [];
let tokens: String[] = [];

async function main() {

    console.log('Doomsday Protocol')
  
    const admin = (await hre.ethers.getSigners())[0];

    for(let p in POOLS){
        pools.push(POOLS[p].POOL)
        tokens.push(POOLS[p].TOKEN)
    }
  
    const Controller = await ethers.getContractFactory("PaladinController");
    const DoomsdayController = await ethers.getContractFactory("DoomsdayController");
    const Registry = await ethers.getContractFactory("AddressRegistry");
    const PalLoanToken = await ethers.getContractFactory("PalLoanToken");
  
    const old_controller = Controller.attach(CONTROLLER);
    const registry = Registry.attach(ADDRESS_REGISTRY);
    const loanToken = PalLoanToken.attach(PAL_LOAN_TOKEN);
  
    const doomsday_controller = await DoomsdayController.deploy();
    await doomsday_controller.deployed();

    await doomsday_controller.setInitialPools(tokens, pools);

    console.log('Doomsday Controller : ')
    console.log(doomsday_controller.address);

    console.log('Set Doomsday Controller on all contracts : ')

    await old_controller.setPoolsNewController(doomsday_controller.address);

    await loanToken.setNewController(doomsday_controller.address);

    await registry._setController(doomsday_controller.address);
    
}
  
  
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });