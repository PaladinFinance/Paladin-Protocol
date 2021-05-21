# `palToken`


This is a basic ERC20 token, with the basic ERC20 functions


The `mint` and `burn` functions are only accessible by the palPool linked to the palToken


# `palPool`


A palPool hold the governance token, allows user to deposit or withdraw them, and to create Borrows.



### `deposit(uint amount)`
Send the underlying token to the Pool, and gets a palToken in returned, representing the amount deposited + all accrued interests  

The `amount` parameter is in the underlying token  



### `withdraw(uint amount)`
Send an amount of palToken to the Pool to retrieve a corresponding amount of underlying token  

The `amount` parameter is in the palToken  



### `borrow(uint amount, uint feesAmount)`
Creates a new Borrow, and deploy a new Loan Pool contract to hold the loan.  

A minimum amount of fees (depending on the amount) is needed, to cover the minimum Borrow duration at the current Borrow Rate  

`amount` parameter is the amount of underlying token to borrow (in the underlying token)  

`feesAmount` parameter is the amount of fees paid for the loan (in the underlying token)  


### `expandBorrow(addres loanPool, uint feesAmount)`
Reserved for the Loan owner.  

Allow to pay an extra amount of fees to expand the Loan duration  

`feesAmount` parameter is the amount of fees too add to the loan fees (in the underlying token)  

`loanPool` parameter is the address of the loan to expand  


### `closeBorrow(address loanPool)`
Reserved for the Loan owner.  

Allow to close a Borrow, and retrieve all unused fees from the Loan.  

If closed before the minimum Borrow time (currently 7 weeks), the borrower will lose paid fees +
amount to pay up to the minimum duration  

`loanPool` parameter is the address of the loan to close  


### `killBorrow(address loanPool)`
Forbidden to Loan owner.  

Allow to kill a Loan that used all of its fees (= loan duration is over).  

Killer (caller of this function) gets a reward for killing the Loan.  

`loanPool` parameter is the address of the loan to kill  


### Data fetching methods : 


`_underlyingBalance() public view returns(uint);`  
-> Return the amount of underlying token in the Pool (in wei)  

`getPalToken() external view returns(address);`  
-> Return address of the linked palToken  


`balanceOf(address _account) external view returns(uint); ` 
-> Return balance of the user in palToken (in wei)  
  
`underlyingBalanceOf(address _account) external view returns(uint)`
-> Return balance of the user in the underlying token (in wei)  


`getLoansPools() external view returns(address [] memory); ` 
-> Return a list of all the Loans (active or closed)  
  
`getLoansByBorrower(address borrower) external view returns(address [] memory);`  
-> Return a list of all the user's Loans (active or closed)  
  
`getBorrowDataStored(address __loanPool) external view returns`
(
    address _borrower,  
    address _loan,  
    uint _amount,  
    address _underlying,  
    uint _feesAmount,  
    uint _feesUsed,  
    uint _startBlock,  
    bool _closed  
)  
-> Return all the data stored for the given loan (parameter __loanPool is the address of the deployed palLoan -> can be found through getLoansByBorrower)  

`borrowRatePerBlock() external view returns (uint);`  
-> Return the current Borrow Rate (scale 1e18)  
  
`supplyRatePerBlock() external view returns (uint);`  
-> Return the current Supply Rate (scale 1e18)  
  
`exchangeRateStored() external view returns (uint);`  
-> Return the last updated Exchange Rate (scale 1e18)  
  
`minBorrowFees(uint _amount) external view returns (uint);`  
-> Amount minimum of fees to allow the borrow() method. Calculated on the given amount parameter (in wei).
Return the mnimum amount of fees (in wei)  




(For data returned on scale 1e18, dividing it by 1e18 will give the real value)


## `palLoan`

A smart contract deployed by a palPool to bear the Loan, and delegate the governance power to the borrower.

Also holds the fees paid by the borrower.



## `PaladinController`


Controller contract, that list all palTokens & palPools




## `InterestModule`


Smart contract to calculate Utilization Rate, Borrow Rate and Supply Rate of a palToken Pool. Based on a JumpRate Interest Model

