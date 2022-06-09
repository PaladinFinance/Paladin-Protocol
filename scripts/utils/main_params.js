const { ethers } = require("hardhat");

// Addresses for all_deploy :

const TOKENS = {
    COMP: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    STKAAVE: "0x4da27a545c0c5B758a6BA100e3a049001de870f5",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    IDLE: "0x875773784Af8135eA0ef43b5a374AaD105c5D39e",
    INDEX: "0x0954906da0Bf32d5479e25f46056d22f08464cab",
    PAL: "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF",
    HPAL: "0x624D822934e87D3534E435b83ff5C19769Efd9f6",
}

const DELEGATOR_NAMES = {
    BASIC_DELEGATOR: 'BasicDelegator',
    AAVE_DELEGATOR: 'AaveDelegator',
    AAVE_DELEGATOR_CLAIMER: 'AaveDelegatorClaimer',
    SNAPSHOT_DELEGATOR: 'SnapshotDelegator',
    PAL_DELEGATOR_CLAIMER: 'PalDelegatorClaimer'
}

const MULTIPLIER_NAMES = {
    GOVERNOR: 'GovernorMultiplier',
    AAVE: 'AaveMultiplier',
    INDEX: 'IndexMultiplier',
    HPAL: 'HolyPalMultiplier'
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
    INDEX: {
        NAME: MULTIPLIER_NAMES.INDEX,
        CURRENT_QUORUM: "215000"
    },
    HPAL: {
        NAME: MULTIPLIER_NAMES.HPAL,
        HPAL_ADDRESS: "0x624D822934e87D3534E435b83ff5C19769Efd9f6"
    },
}

const MULTIPLIER_KEYS = {
    'COMP': MULTIPLIER_CONTRACTS.COMP,
    'UNI': MULTIPLIER_CONTRACTS.UNI,
    'AAVE': MULTIPLIER_CONTRACTS.AAVE,
    'IDLE': MULTIPLIER_CONTRACTS.IDLE,
    'INDEX': MULTIPLIER_CONTRACTS.INDEX,
    'HPAL': MULTIPLIER_CONTRACTS.HPAL,
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
    INDEX: {
        UNDERLYING: TOKENS.INDEX,
        DELEGATOR: 'SNAPSHOT_DELEGATOR',
        NAME: 'Paladin INDEX',
        SYMBOL: 'palINDEX',
        MUTIPLIER: 'INDEX'
    },
    HPAL: {
        UNDERLYING: TOKENS.HPAL,
        DELEGATOR: 'PAL_DELEGATOR_CLAIMER',
        NAME: 'Paladin hPAL',
        SYMBOL: 'palhPAL',
        MUTIPLIER: 'HPAL'
    }
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
    INDEX: {
        POOL: "0xa8AFa64C91356FF2A3fAFd8324F0552EB8e76632",
        TOKEN: "0xCd1cE671C6FC7fa8115a255B307e0133Ff1dfdFF"
    },
    HPAL: {
        POOL: "0x62F7790C49BA7F049DBb3EF2Cc1046A3103f025e",
        TOKEN: "0xB28305908Af8f3cCc36b194CfCbCA3A42212376F"
    },
}

const PAL_LOAN_TOKEN = "0x55DA1CBD77B1c3b2d8Bfe0F5fDF63d684b49F8A5";

const CONTROLLER = "0x241326339ced11EcC7CA07E4AA350234C57F53E5";

const CONTROLLER_IMPL = "0xCf131548B18D55Fb29DF2df47b360C41389EbB2b";

const INTEREST_MODULE = "";

const INTEREST_MODULE_V2 = "0x076D4cf37E48B9265E05D57f280EfF562b177476";

const ADDRESS_REGISTRY = "0x90e0f42F5c6Cdcc77Bc68a545F27E56E4398B75f";

const PRICE_ORACLE = "0x0186647A0B419f41C59F60E6291cad230a3ED4BA";

const OLD_DELEGATORS = {
    BASIC_DELEGATOR: "0x12Cb3F4e80b795bc77090A7c412B1f804Ee085a8",
    AAVE_DELEGATOR: "0xE8784DE8c74B1543341C8828561d13c4b129251f",
    AAVE_DELEGATOR_CLAIMER: "0xA35C7681655811Ad3BefD76B45c3B2920F0C613C",
    SNAPSHOT_DELEGATOR: "0xD53D7e4A1E5D79083592E436570b34023F664b87"
}

const DELEGATORS = {
    SNAPSHOT_DELEGATOR: "0x1579D941e49183ce38dc2f8CA45a2269B4226F86",
    PAL_DELEGATOR_CLAIMER: "0x2ca786105163CF5228fE80E77C75D3b081287458"
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
    INDEX: {
        NAME: MULTIPLIER_NAMES.INDEX,
        CONTRACT: MULTIPLIER_CONTRACTS.INDEX,
        ADDRESS: "0xdCaA23fec70e0E867cD8Cd77c9eaaF34E7c73a44",
        POOLS: [
            POOLS.INDEX.POOL
        ]
    },
    HPAL: {
        NAME: MULTIPLIER_NAMES.HPAL,
        CONTRACT: MULTIPLIER_CONTRACTS.HPAL,
        ADDRESS: "0xB5B51a7Da57fE6Db797abD787ddfD923daaBaADc",
        POOLS: [
            POOLS.HPAL.POOL
        ]
    },
}


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