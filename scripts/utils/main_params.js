const { ethers } = require("hardhat");

// Addresses for all_deploy :

const TOKENS = {
    COMP: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    STKAAVE: "0x4da27a545c0c5B758a6BA100e3a049001de870f5",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    IDLE: "0x875773784Af8135eA0ef43b5a374AaD105c5D39e"
}

const DELEGATOR_NAMES = {
    BASIC_DELEGATOR: 'BasicDelegator',
    AAVE_DELEGATOR: 'AaveDelegator',
    AAVE_DELEGATOR_CLAIMER: 'AaveDelegatorClaimer',
    SNAPSHOT_DELEGATOR: 'SnapshotDelegator'
}

const MULTIPLIER_NAMES = {
    GOVERNOR: 'GovernorMultiplier',
    AAVE: 'AaveMultiplier'
}

const MULTIPLIER_CONTRACTS = {
    COMP: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Compound',
        GOVERNOR_ADDRESS: "0xc0Da02939E1441F497fd74F78cE7Decb17B66529"
    },
    UNI: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Uniswap',
        GOVERNOR_ADDRESS: "0x408ED6354d4973f66138C91495F2f2FCbd8724C3"
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        GOV: 'Aave',
        GOVERNANCE_ADDRESS: "0xEC568fffba86c094cf06b22134B23074DFE2252c",
        STRATEGY_ADDRESS: "0xEE56e2B3D491590B5b31738cC34d5232F378a8D5",
    },
    IDLE: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Idle',
        GOVERNOR_ADDRESS: "0x2256b25CFC8E35c3135664FD03E77595042fe31B"
    },
}

const MULTIPLIER_KEYS = {
    'COMP': MULTIPLIER_CONTRACTS.COMP,
    'UNI': MULTIPLIER_CONTRACTS.UNI,
    'AAVE': MULTIPLIER_CONTRACTS.AAVE,
    'IDLE': MULTIPLIER_CONTRACTS.IDLE,
}


const POOLS_PARAMS = {
    COMP: {
        UNDERLYING: TOKENS.COMP,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin COMP',
        SYMBOL: 'palCOMP',
        MUTIPLIER: 'COMP'
    },
    UNI: {
        UNDERLYING: TOKENS.UNI,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin UNI',
        SYMBOL: 'palUNI',
        MUTIPLIER: 'UNI'
    },
    AAVE: {
        UNDERLYING: TOKENS.AAVE,
        DELEGATOR: 'AAVE_DELEGATOR',
        NAME: 'Paladin AAVE',
        SYMBOL: 'palAAVE',
        MUTIPLIER: 'AAVE'
    },
    STKAAVE: {
        UNDERLYING: TOKENS.STKAAVE,
        DELEGATOR: 'AAVE_DELEGATOR_CLAIMER',
        NAME: 'Paladin stkAAVE',
        SYMBOL: 'palStkAAVE',
        MUTIPLIER: 'AAVE'
    },
    IDLE: {
        UNDERLYING: TOKENS.IDLE,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin IDLE',
        SYMBOL: 'palIDLE',
        MUTIPLIER: 'IDLE'
    },
}

const PAL_LOAN_TOKEN_URI = "about:blank"

const INTEREST_MODULE_VALUES = {
    BASE_RATE_PER_YEAR: ethers.utils.parseEther('0.25'),
    MULTIPLIER_PER_YEAR: ethers.utils.parseEther('0.9375'),
    JUMP_MULTIPLIER_PER_YEAR: ethers.utils.parseEther('13.25')
}


const ORACLE_BASE_SOURCE = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"

const ORACLE_ASSET_LIST = {
    UNI: {
        ASSET: "0x7fFad0dA714f4595fC9c48FE789d76b9137D7245",
        SOURCE: "0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e",
        SOURCE_USD: "0x553303d460EE0afB37EdFf9bE42922D8FF63220e"
    },
    COMP: {
        ASSET: "0x8f5C4486Fd172a63f6E7F51902bb37Cd5CD010b4",
        SOURCE: "0x1B39Ee86Ec5979ba5C322b826B3ECb8C79991699",
        SOURCE_USD: "0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5"
    },
    AAVE: {
        ASSET: "0xa4dd29192B42C5039Fd9356382a5d57218C9d650",
        SOURCE: "0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012",
        SOURCE_USD: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9"
    },
    STKAAVE: {
        ASSET: "0x24E79e946dEa5482212c38aaB2D0782F04cdB0E0",
        SOURCE: "0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012",
        SOURCE_USD: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9" 
    },
    IDLE: {
        ASSET: "0x3F482847D97937C2C13626FE98dD44c68E29eb29",
        SOURCE: ethers.constants.AddressZero,
        SOURCE_USD: ethers.constants.AddressZero
    },
}


//Already deployed contracts : 


const POOLS = {
    COMP: {
        POOL: "0x50bE5fE4de4efC3A0adAc6587254836972055423",
        TOKEN: "0x8f5C4486Fd172a63f6E7F51902bb37Cd5CD010b4"
    },
    UNI: {
        POOL: "0x7835d976516F82cA8a3Ed2942C4c6F9C4E44bb74",
        TOKEN: "0x7fFad0dA714f4595fC9c48FE789d76b9137D7245"
    },
    AAVE: {
        POOL: "0x7ba283b1dDCdd0ABE9D0d3f36345645754315978",
        TOKEN: "0xa4dd29192B42C5039Fd9356382a5d57218C9d650"
    },
    STKAAVE: {
        POOL: "0xCDc3DD86C99b58749de0F697dfc1ABE4bE22216d",
        TOKEN: "0x24E79e946dEa5482212c38aaB2D0782F04cdB0E0"
    },
    IDLE: {
        POOL: "0xb7a5e68D89950a92F6C7dA33919D8415b1384A25",
        TOKEN: "0x3F482847D97937C2C13626FE98dD44c68E29eb29"
    },
}

const PAL_LOAN_TOKEN = "0x55DA1CBD77B1c3b2d8Bfe0F5fDF63d684b49F8A5";

const CONTROLLER = "0x241326339ced11EcC7CA07E4AA350234C57F53E5";

const CONTROLLER_IMPL = "0x951cab249ca907313c9a510ae1b7a0dfb24dcbbd";

const INTEREST_MODULE = "";

const INTEREST_MODULE_V2 = "0x076D4cf37E48B9265E05D57f280EfF562b177476";

const ADDRESS_REGISTRY = "0x90e0f42F5c6Cdcc77Bc68a545F27E56E4398B75f";

const PRICE_ORACLE = "0x0186647A0B419f41C59F60E6291cad230a3ED4BA";

const DELEGATORS = {
    BASIC_DELEGATOR: "0x12Cb3F4e80b795bc77090A7c412B1f804Ee085a8",
    AAVE_DELEGATOR: "0xE8784DE8c74B1543341C8828561d13c4b129251f",
    AAVE_DELEGATOR_CLAIMER: "0xA35C7681655811Ad3BefD76B45c3B2920F0C613C",
    SNAPSHOT_DELEGATOR: "0xD53D7e4A1E5D79083592E436570b34023F664b87"
}

const MULTIPLIERS = {
    COMP: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.COMP,
        ADDRESS: "0x5e71566F490c04717EA7c536631CA5b0d01B1522",
        POOLS: [
            POOLS.COMP.POOL
        ]
    },
    UNI: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.UNI,
        ADDRESS: "0x09A2820f950Fb16D7E44A6bAB8d3E2DE0a905A08",
        POOLS: [
            POOLS.UNI.POOL
        ]
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        CONTRACT: MULTIPLIER_CONTRACTS.AAVE,
        ADDRESS: "0x7878d37Dd00Cc400154EaA985cb8cc2DFcBCaaD9",
        POOLS: [
            POOLS.AAVE.POOL,
            POOLS.STKAAVE.POOL
        ]
    },
    IDLE: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.IDLE,
        ADDRESS: "0x5Ed896DC55C9E1425c5183453dADD4b68b7D2156",
        POOLS: [
            POOLS.IDLE.POOL
        ]
    },
}



// ------------- MultiPool Part ----------------------

const MULTI_CONTROLLER = ""

const MULTI_LOAN_TOKEN = ""

const MULTI_PSP_UNDERLYING = [
    "0x55A68016910A7Bcb0ed63775437e04d2bB70D570", // sPSP1
    "0xea02DF45f56A690071022c45c95c46E7F61d3eAb", // sPSP3
    "0x6b1D394Ca67fDB9C90BBd26FE692DdA4F4f53ECD", // sPSP4
    "0x37b1E4590638A266591a9C11d6f945fe7A1adAA7", // sPSP7
    "0x03C1EafF32c4bd67ee750AB75Ce85BA7e5Aa65fB", // sPSP8
    "0xC3359DbdD579A3538Ea49669002e8E8eeA191433", // sPSP9
    "0x36d69afE2194F9A1756ba1956CE2e0287A40F671", // sPSP10
]

const MULTI_PSP_PALTOKENS_PARAMS = [
    {
        NAME: 'Paladin sPSP1',
        SYMBOL: 'palsPSP1',
    },
    {
        NAME: 'Paladin sPSP3',
        SYMBOL: 'palsPSP3',
    },
    {
        NAME: 'Paladin sPSP4',
        SYMBOL: 'palsPSP4',
    },
    {
        NAME: 'Paladin sPSP7',
        SYMBOL: 'palsPSP7',
    },
    {
        NAME: 'Paladin sPSP8',
        SYMBOL: 'palsPSP8',
    },
    {
        NAME: 'Paladin sPSP9',
        SYMBOL: 'palsPSP9',
    },
    {
        NAME: 'Paladin sPSP10',
        SYMBOL: 'palsPSP10',
    },
]

const MULTI_PSP_PALTOKENS = [
    "", // palsPSP1
    "", // palsPSP3
    "", // palsPSP3
    "", // palsPSP7
    "", // palsPSP8
    "", // palsPSP9
    "", // palsPSP10
]

const MULTI_POOL_PSP_PARAMS = {
    UNDERLYINGS: MULTI_PSP_UNDERLYING,
    PALTOKENS: MULTI_PSP_PALTOKENS,
    DELEGATOR: 'SNAPSHOT_DELEGATOR',
    MUTIPLIER: 'NONE'
}

// ----------------------------------------------------


module.exports = {
    TOKENS,
    DELEGATOR_NAMES,
    POOLS_PARAMS,
    POOLS,
    PAL_LOAN_TOKEN,
    CONTROLLER,
    CONTROLLER_IMPL,
    INTEREST_MODULE,
    INTEREST_MODULE_V2,
    ADDRESS_REGISTRY,
    DELEGATORS,
    PAL_LOAN_TOKEN_URI,
    MULTIPLIER_CONTRACTS,
    MULTIPLIER_NAMES,
    INTEREST_MODULE_VALUES,
    MULTIPLIERS,
    MULTIPLIER_KEYS,
    ORACLE_BASE_SOURCE,
    ORACLE_ASSET_LIST,
    PRICE_ORACLE
};