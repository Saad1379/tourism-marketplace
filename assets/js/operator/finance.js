let financeFilter = {};

$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    financeFilter = {};
    setFinanceList();
});

$(document).on("click", "#account_number_hide_show", function(e) {
    let accountNumberVisible = $("#account_number_visible");
    let accountNumberHidden = $("#account_number_hidden");
    accountNumberVisible.toggle();
    accountNumberHidden.toggle();
    if (accountNumberVisible.is(":visible")) {
      $(this).removeClass('fa-eye-slash').addClass('fa-eye');  
    } else {
      $(this).removeClass('fa-eye').addClass('fa-eye-slash');  
    };
});

$(document).on("click", "#bankAddModalBtn", function(e) {
    $("#bank_name").val("");
    $("#bank_account_holder_name").val("");
    $("#account_number").val("");
    $("#confirm_account_number").val("");
    $("#swift_code").val("");
});

$(".numericInput").on("input", function() {
    $(this).val($(this).val().replace(/[^0-9\.]/g, ''));
});

$(document).on("click", "#send_withdraw_request_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();

    let totalWithdrawAmount = $("#total_wallet_balance").data("withdraw-amount");

    let payload = {
        withdrawAmount: parseFloat(totalWithdrawAmount),
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/wallet-withdraw-request", payload, function(response) {
        if(response.flag === 1) {
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
            }, 800);
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1000);
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showToast(response.flag, response.msg);
            $("#send_withdraw_request_btn").removeClass("btn-disabled");
        };
    });
});

$(document).on("click", "#add_bank_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();

    let bankName = $("#bank_name").val();
    let bankAccountHolderName = $("#bank_account_holder_name").val();
    let accountNumber = $("#account_number").val();
    let swiftCode = $("#swift_code").val();

    if(!validateOperatorAddBankForm()) {
        $("#p_loader").addClass("d-none");
        return;
    };

    let payload = {
        bankName: bankName,
        bankAccountHolderName: bankAccountHolderName,
        accountNumber: accountNumber,
        swiftCode: swiftCode,
    };
    $(this).addClass("btn-disabled");

    postAjaxCall("/add-bank", payload, function(response) {
        $("#p_loader").addClass("d-none");
        if(response.flag === 1) {
            showToast(response.flag, response.msg);
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showToast(response.flag, response.msg);
            $("#add_bank_btn").removeClass("btn-disabled");
        };
    });
});

function validateOperatorAddBankForm() {
    let bankName = $("#bank_name").val();
    let bankAccountHolderName = $("#bank_account_holder_name").val();
    let accountNumber = $("#account_number").val();
    let confirmAccountNumber = $("#confirm_account_number").val();
    let swiftCode = $("#swift_code").val();

    if(!bankName) {
        showToast(0, "Please enter bank name");
        return false;
    };

    if(!bankAccountHolderName) {
        showToast(0, "Please enter bank account holder name.");
        return false;
    };

    if(bankAccountHolderName.length < 3) {
        showToast(0, "Bank account holder name must be atleast 3 characters.");
        return false;
    };

    if(bankAccountHolderName.length > 15) {
        showToast(0, "Bank account holder name must be atmost 15 characters.");
        return false;
    };

    if(!accountNumber) {
        showToast(0, "Please enter account number.");
        return false;
    };

    if(!confirmAccountNumber) {
        showToast(0, "Please add re-enter account number.");
        return false;
    };

    if(confirmAccountNumber && parseInt(confirmAccountNumber) !== parseInt(accountNumber)) {
        showToast(0, "Both account number do not match. Please ensure both account number match.");
        return false;
    };

    if(!swiftCode) {
        showToast(0, "Please enter swift code.");
        return false;
    };

    return true;
};

function setFinanceList() {
    let data = {};

    if (financeFilter?.financeStatus) {
        data.status = financeFilter?.financeStatus;
    };

    if (financeFilter?.amount) {
        data.amount = parseFloat(financeFilter?.amount);
    };

    if (financeFilter?.transactionId) {
        data._id = financeFilter?.transactionId;
    };

    setFilters(data);
    filterPaginationData("/withdraw-request-list", "table-data", "pagination_table_view");
};
