var filter_url = '';
var filters = {
    totalItems: 0,
    itemPerPage: 10,
    currentPage: 1,
    totalPages: 1
};
var multipleFilter = [];
var div_id = '';

$(document).ready(function() {
    $('#recordPerPage').val(filters.itemPerPage);
    $('#status_search').trigger('focus');

    $(document).on('click', '.page_no', function() {
        var cp = $(this).data('page');
        var table = $(this).data('table');

        filters.currentPage = cp;
        var furl = multipleFilter[table]['filter_url'];
        filterData(furl, table);
    });
});

$(document).on("click", ".copy-btn", function() {
    var copyText = $(this).data("copy-text");
    var temp = $("<input>");
    $("body").append(temp);
    temp.val(copyText).select();
    document.execCommand("copy");
    temp.remove();
    const tooltip = $(this).closest(".c-tooltip");
    tooltip.attr("tooltip-text", "Copied");
    $(this).attr("src", "/images/check.svg");
    setTimeout(() => {
        $(this).attr("src", "/images/copy.svg");
        tooltip.attr("tooltip-text", "Copy to Clipboard");
    }, 1000); 
});

// Admin
$("#log-out").on("click", function (event) {
    $('.preloader').fadeIn();
    event.preventDefault();
    postAjaxCall('/admin/logout', {}, function(response) {
        if (response.flag == 1) {
            localStorage.clear();
            $('.preloader').fadeOut();
            setTimeout(() => {
                window.location.href = `/admin/login/${response.data.login_secret_token}`;
            }, 500); 
        }
    });
});

// Affiliate
$(document).on("click", "#affiliate_log_out_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/logout", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            localStorage.clear();
            window.location.href = "/";
        };
    });
});

$(document).on("click", "#affiliate_account_deactive_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/deactive-account", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 1000);
        if (response.flag === 1) {
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1500);
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
                localStorage.clear();
                window.location.href = "/";
            }, 2500);
        };
    });
});

// Operator
$(document).on("click", "#operator_log_out_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/logout", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            localStorage.clear();
            window.location.href = "/";
        };
    });
});

$(document).on("click", "#operator_account_deactive_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/deactive-account", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 1000);
        if (response.flag === 1) {
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1500);
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
                localStorage.clear();
                window.location.href = "/";
            }, 2500);
        };
    });
});

// User
$(document).on("click", "#user_log_out_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/logout", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 800);
        if (response.flag === 1) {
            localStorage.clear();
            window.location.href = "/";
        };
    });
});

$(document).on("click", "#user_account_deactive_btn", function(e) {
    $("#p_loader").removeClass("d-none");
    e.preventDefault();
    postAjaxCall("/deactive-account", {}, function(response) {
        setTimeout(() => {
            $("#p_loader").addClass("d-none");
        }, 1000);
        if (response.flag === 1) {
            setTimeout(() => {
                showToast(response.flag, response.msg);
            }, 1500);
            setTimeout(() => {
                $("#p_loader").addClass("d-none");
                localStorage.clear();
                window.location.href = "/";
            }, 2500);
        };
    });
});

$(".open_new_modal_btn").on("click", function (event) {
    let modelType = $(this).data("model-type");
    if(parseInt(modelType) === 1){
        $("#signInModel").modal("hide");
        $("#signUpModel").modal("show");
        $("#register_email").val("");
        $("#register_email_send_success_text").addClass("d-none");
    } else {
        $("#signUpModel").modal("hide");
        $("#signInModel").modal("show");
        $("#login_email").val("");
        $("#login_email_send_success_text").addClass("d-none");
    };
});

$(window).on('load', function() {
    $('.preloader').fadeOut();
});

$(".menu-bars").click(function(){
    $("body").addClass("active-menu");
});

$(".sidebar-close").click(function(){
    $("body").removeClass("active-menu");
});

$(document).on("click", "#back-to-dashboard", function () {
    window.location.href = "/admin/admin-dashboard";
});

$("#btn-close-modal").on("click", function(){
    location.reload(1)
});

function changeRecordPerPage(url, table) {
    var id = '';
    if (typeof table !== 'undefined') {
        id = '-' + table;
    };

    var recPp = $('#recordPerPage' + id).val();
    if (isNaN(recPp)) {
        showToast(0, "Please select valid page limit");
        return false;
    } else if (recPp == "") {
        filters.itemPerPage = 10;
        $("#recordPerPage" + id).val(10);
    } else if (recPp < 1) {
        showToast(0, "Please select valid page limit");
        return false;
    } else {
        filters.itemPerPage = recPp;
    };

    filters.currentPage = 1;

    if (typeof table === 'undefined') {
        table = 'table-data';
    };

    filterData(url, table);
};

async function filterData(url, table) {
    $(".search_btn_show").attr('disabled', true);
    var token = $("#token").val();
    filters._token = token;

    if (typeof table === 'undefined') {
        table = 'table-data';
    };

    var flush = 1;
    if (typeof multipleFilter[table] !== 'undefined' && typeof multipleFilter[table]['filters'] !== 'undefined') {
        flush = 0;
        $.each(multipleFilter[table]['filters'], function(k, v) {
            if (typeof filters[k] === 'undefined') {
                filters[k] = v;
            };
        });
    } else {
        multipleFilter[table] = {};
    };

    var jdata = filters;
    filter_url = url;
    $(".pagination").addClass("btn-disabled");
    $(".pagination li").addClass("btn-disabled"); 

    await $.ajax({
        type: 'POST',
        url: url,
        data: JSON.stringify(jdata),
        dataType: "json",
        contentType: "application/json",
        success: function(res) {
            if (res.flag === 0) {
                filters.totalItems = 0;
                filters.totalPages = 0;
                $("#" + table).html("");
                $(".pagination").html("");
            } else {
                $("#" + table).html(res.blade);
                filters.totalItems = res["total_record"];

                if(filters.totalItems <= 10){
                    $(".pagination-show").addClass("d-none");
                    $(".pagination-area").addClass("d-none");
                } else {
                    $(".pagination-area").removeClass("d-none");
                    $(".pagination-show").removeClass("d-none");
                };

                if(res.booking_pay_amount_view){
                    let final_pay_amount = res?.total_operator_commission_Amount ? res?.total_operator_commission_Amount : 0;
                    $("#final_operator_pay_amount").html("$ " + final_pay_amount);
                };

                filters.totalPages = filters.totalItems > 0 ? Math.ceil(filters.totalItems / filters.itemPerPage) : 0;
                if(filters.totalPages > 0){
                    $('#pagination-div').removeClass('d-none');
                    setPagination(table);
                } else {
                    $('#pagination-div').addClass('d-none');
                    $(".pagination").html("");
                };
            };

            if (res['is_filter_visible'] == 0) {
                $(`#${table}-list-pagination`).addClass("d-none");
            } else {
                $(`#${table}-list-pagination`).removeClass("d-none");
            };

            $(".pagination").removeClass('btn-disabled');
            $(".pagination li a").removeClass("btn-disabled"); 
            $("#search_option_bet").removeClass("btn-disabled");
            $("#wizard-next").removeClass("btn-disabled");

            multipleFilter[table]['filters'] = filters;
            multipleFilter[table]['filter_url'] = filter_url;
            flushFilters(flush);
            $(".search_btn_show").attr('disabled', false);
        },
    }).fail(function () {
        $(".pagination li a").removeClass("btn-disabled"); 
    });
};

function setFilters(searchObject, removeField) {
    filters = {...filters, ...searchObject};

    if(removeField) {
        filters[removeField] = "";
    };
    filters.currentPage = 1;
};

function resetFilters(searchObject, table) {
    if (typeof table !== "undefined" && typeof multipleFilter[table] !== "undefined") {
        multipleFilter[table]["filters"] = filters;
    };

    filters = {...filters, ...searchObject};
    filters.currentPage = 1;

    if (filters?.multiselect?.length == 0) {
        delete filters.multiselect;
    };
};

function flushFilters(keep) {
    if (keep) {
        filters = {
            totalItems: 0,
            itemPerPage: filters.itemPerPage,
            currentPage: 1,
            totalPages: 1,
        };
    } else {
        filters = {};
    };
};

function paginationInput(e, cp, tp, table) {
    let newPage = $(e.target).val();
    if (!newPage) return false;

    newPage = Number(newPage);
    const currentPage = Number(cp);
    const totalPage = Number(tp);

    if (Number.isNaN(newPage) || Number.isNaN(totalPage) || newPage <= 0 || newPage > totalPage) {
       $(e.target).val(currentPage);
       return;
    };

    filters.currentPage = newPage;
    var furl = multipleFilter[table]["filter_url"];
    filterData(furl, table);
};

function setPagination(table) {
    var tp = filters.totalPages;
    var cp = filters.currentPage;
    var p = prevPage(cp, tp, 0);
    var li = '';

    var fl = '<li class="page-item"><a class="page-link page_no" data-page="' + 1 + '"  data-table="' + table + '" data-type="f"><svg width="9" height="8" viewBox="0 0 9 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.27344 7.5L4.77344 4L8.27344 0.5" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /><path d="M4.1875 7.5L0.6875 4L4.1875 0.5" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /></svg></a></li>';

    var ll = '<li class="page-item"><a data-page="' + tp + '" data-type="l" data-table="' + table + '" class="page-link page_no"><svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.960938 8.44824L4.50793 4.99588L1.05557 1.44888" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /><path d="M5.04688 8.50391L8.59387 5.05154L5.14151 1.50455" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /></svg></a></li>';

    var pp = '<li class="page-item"><a data-page="' + p + '" data-type="p"  data-table="' + table + '" class="page-link page_no"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.22656 7.5L0.726562 4L4.22656 0.5" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /></svg></a></li>';

    var p = prevPage(cp, tp, 1);

    var np = '<li class="page-item"><a data-page="' + p + '" data-type="n"  data-table="' + table + '" class="page-link page_no"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.84375 7.5L4.34375 4L0.84375 0.5" stroke="#171D25" stroke-linecap="round" stroke-linejoin="round" /></svg></a></li>';

    var ns = "";
    var ps = "";

    li += '<li class="page-item active"><div data-table="' + table + `" class="d-flex justify-content-center align-items-center i--pagination text-center pagination-div-tag"><input type="text" class="form-control shadow-none px-0 text-center pagination-input" value="${cp}" min="1" max="${tp}" onchange="paginationInput(event, ${cp}, ${tp}, '${table}')" style="width: 20px;"><div class="p-divider">/</div><div>${tp}</div></div></li>`;

    li = fl + pp + ps + li + ns + np + ll;
    var cls1 = "";
    var cls2 = "";
    if ($(".pagination").hasClass(table)) {
        cls1 = "." + table;
        cls2 = "." + table;
    };

    $(cls1 + ".pagination").html(li);

    $(cls1 + " .page_no").each(function () {
        var tp = $(this).data("type");
        if (tp == cp) {
           $(this).addClass("active");
        };
    });

    let id = "";
    if (table !== "table-data") {
        id = "-" + table;
    };
    $("#recordPerPage" + id).find("option[value='" + filters.itemPerPage + "']").attr("selected", true);

    if (cp == 1) {
        $(cls2 + ".pagination li:first-child").removeClass("page_no").addClass("btn-disabled");
        $(cls2 + ".pagination li:nth-child(2)").removeClass("page_no").addClass("btn-disabled");
    };

    if (cp == tp) {
        $(cls2 + ".pagination li:last-child").removeClass("page_no").addClass("btn-disabled");
        $(cls2 + ".pagination li:nth-last-child(2)").removeClass("page_no").addClass("btn-disabled");
        $(cls2 + ".pagination li .pagination-div-tag").addClass("btn-disabled");
    };
};

function prevPage(cp, tp, t) {
    var p = 1;
    if (t) {
        p = cp + 1 < tp ? cp + 1 : tp > 0 ? tp : 1;
    } else {
        p = cp - 1 > 0 ? cp - 1 : 1;
    };
    return p;
};

function nextDigit(cp, tp, t) {
    if (t) {
        for (i = cp; i <= tp; i++) {
            if (i % 7 == 0) {
                return i;
            };
        };
        return tp;
    } else {
        for (i = cp; i > 0; i--) {
            if (i % 7 == 0) {
                return i;
            };
        };
        return 1;
    };
};

async function filterPaginationData(url, table, paginationId = "") {
    if(typeof table === "undefined") {
        table = "table-data";
    };
    var flush = 1;
    if(typeof multipleFilter[table] !== "undefined" && typeof multipleFilter[table]["filters"] !== "undefined" ){
        flush = 0;
        $.each(multipleFilter[table]["filters"], function (k, v) {
            if (typeof filters[k] === "undefined") {
                filters[k] = v;
            };
        });
    } else {
        multipleFilter[table] = {};
    };
    var jdata = filters;
    filter_url = url;
    $(".pagination_div_view").addClass('pagination-disable');
    $(".pagination_div_view nav>ul>li").prop("disabled", true); // Disable buttons
    await $.ajax({
       type: "POST",
       url: url,
       data: JSON.stringify(jdata),
       dataType: "json",
       contentType: "application/json",
       success: function (res) {
            if (res.flag === 0) {
                filters.totalItems = 0;
                filters.totalPages = 0;
                $("#" + table).html("");
            } else {
                $("#" + table).html(res.blade);
                filters.totalItems = res["total_record"];
                filters.totalPages =  filters.totalItems > 0 ? Math.ceil(filters.totalItems / filters.itemPerPage) : 0;
                if(filters.totalPages > 0 && paginationId !== ""){
                    $('.pagination_div_view').removeClass('d-none');
                    generatePagination(url, paginationId, table, filters.totalPages, filters.currentPage, res?.param);
                } else {
                    $('.pagination_div_view').addClass('d-none');
                };
            };

            $(".pagination_div_view nav>ul>li").prop("disabled", false); // Re-enable buttons
            $("#search_option_bet").prop("disabled", false);
            flushFilters(flush);
        },
    }).fail(function () {
        $(".pagination_div_view nav>ul>li").prop("disabled", false); 
    });
};

// Function to generate the pagination dynamically
function generatePagination(url, paginationId, table, totalPages, currentPage, param = {}) {
    const paginationContainer = document.getElementById(paginationId);
    paginationContainer.innerHTML = ""; // Clear any existing pagination

    // Create Previous button
    const prevItem = document.createElement("li");
    prevItem.classList.add("page-item");
    prevItem.classList.toggle("disabled", currentPage === 1);
    const prevLink = document.createElement("a");
    prevLink.classList.add("page-link");
    prevLink.href = "javascript:;";
    prevLink.textContent = "Prev";
    prevLink.addEventListener("click", function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            prePage(url, currentPage, table, paginationId, param);
        };
    });
    prevItem.appendChild(prevLink);
    paginationContainer.appendChild(prevItem);

    // Generate page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement("li");
        pageItem.classList.add("page-item");
        const pageLink = document.createElement("a");
        pageLink.classList.add("page-link");
        pageLink.classList.add("number");
        pageLink.classList.toggle("active", i === currentPage);
        pageLink.href = "javascript:;";
        pageLink.textContent = i;
        pageLink.addEventListener("click", function(e) {
            e.preventDefault();
            pageNumber(url, i, table, paginationId, param);
        });
        pageItem.appendChild(pageLink);
        paginationContainer.appendChild(pageItem);
    };

    // Create Next button
    const nextItem = document.createElement("li");
    nextItem.classList.add("page-item");
    nextItem.classList.toggle("disabled", currentPage === totalPages);
    const nextLink = document.createElement("a");
    nextLink.classList.add("page-link");
    nextLink.href = "javascript:;";
    nextLink.textContent = "Next";
    nextLink.addEventListener("click", function(e) {
        e.preventDefault();
        if (currentPage < totalPages) {
            nextPage(url, currentPage, totalPages, table, paginationId, param);
        };
    });
    nextItem.appendChild(nextLink);
    paginationContainer.appendChild(nextItem);
};

function prePage(url, cp, table, paginationId, param = {}) {
    let p = cp - 1 > 0 ? cp - 1 : 1;
    filters.currentPage = p;
    if(Object.keys(param).length > 0){
        filters = { ...filters, ...Object.fromEntries(Object.entries(param).filter(([key]) => key !== 'totalItems' && key !== 'itemPerPage' && key !== 'currentPage' && key !== 'totalPages')) };
    };
    filterPaginationData(url, table, paginationId);
};

function nextPage(url, cp, tp, table, paginationId, param = {}) {
    let p = cp + 1 < tp ? cp + 1 : tp > 0 ? tp : 1;
    filters.currentPage = p;
    if(Object.keys(param).length > 0){
        filters = { ...filters, ...Object.fromEntries(Object.entries(param).filter(([key]) => key !== 'totalItems' && key !== 'itemPerPage' && key !== 'currentPage' && key !== 'totalPages')) };
    };
    filterPaginationData(url, table, paginationId);
};

function pageNumber(url, p, table, paginationId, param = {}) {
    filters.currentPage = p;
    if(Object.keys(param).length > 0){
        filters = { ...filters, ...Object.fromEntries(Object.entries(param).filter(([key]) => key !== 'totalItems' && key !== 'itemPerPage' && key !== 'currentPage' && key !== 'totalPages')) };
    };
    filterPaginationData(url, table, paginationId);
};

function showOwnToast(toastId, msg) {
    if (toastId === 0) {
        toastId = 'error-toast';
    } else if (toastId === 1) {
        toastId = 'success-toast';
    } else if (toastId === 2) {
        toastId = 'warning-toast';
    };
    const toast = $('#' + toastId);
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toast)
    const totastMsg = toast.find('.totast-msg');
    totastMsg.text(msg);
    toastBootstrap.show()
    setTimeout(() => {
        toastBootstrap.hide();
    }, 3000);
};

function showToast(flag, val, time) {
    $("#toast").remove();
    if (!val) return;

    var noti_html = document.createElement("div");
    var att = document.createAttribute("id");
    att.value = "toast";
    noti_html.setAttributeNode(att);

    if (flag == 1) {
        noti_html.className = "notification is-success";
    } else if (flag == 0 || flag == 2) {
        noti_html.className = "notification is-error";
    } else {
        noti_html.className = "notification is-warning";
    };

    $("body").append(noti_html);
    $(noti_html).html(val);
    if (typeof time == "undefined" || time == null) {
        time = 5000;
    };

    setTimeout(function () {
        $("#toast").remove();
        time == null;
    }, time);
};

function postAjaxCall(url, data, callback) {
    $.ajax({
        url: url,
        type: 'POST',
        data: data,
        success: function(response) {
            callback(response);
        }
    });
};

function postFileCall(url, formData, callback) {
    $.ajax({
        type: "POST",
        url: url,
        data: formData,
        contentType: false,    
        processData: false,      
        success: function(response) {
            callback(response);  
           
        },
        error: function(err) {
            console.error('Error:', err);
           
        }
    });
};

function formateThreeDigitAmount(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

function mobileNumberFormat(number) {
    return number.replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
};

function shortDateFormat(date) {
    return date.toLocaleDateString("en-US", {
        weekday: "short",    // "Wed"
        year: "numeric",     // "2025"
        month: "short",      // "Apr"
        day: "2-digit"       // "30"
    });
};

function formatTimeTo12HourWithLeadingZero(timeStr) {
    const [hourMin, period] = timeStr.split(" ");
    let [hour, minute] = hourMin.split(":");
    hour = hour.padStart(2, '0');
    return `${hour}:${minute} ${period}`;
};

function getExpectedPhoneLength(iso2) {
    const phoneLengths = {
        'us': 10,
        'gb': 10,
        'af': 9,
        'al': 9,
        'dz': 9,
        'as': 10,
        'ad': 9,
        'ao': 9,
        'ai': 10,
        'ag': 10,
        'ar': 10,
        'am': 8,
        'aw': 7,
        'ac': 5,
        'au': 15,
        'at': 13,
        'az': 9,
        'bs': 10,
        'bh': 8,
        'bd': 10,
        'bb': 10,
        'by': 10,
        'be': 9,
        'bz': 7,
        'bj': 8,
        'bm': 10,
        'bt': 8,
        'bo': 8,
        'ba': 8,
        'bw': 8,
        'br': 10,
        'io': 7,
        'vg': 10,
        'bn': 7,
        'bg': 9,
        'bf': 8,
        'bi': 8,
        'kh': 8,
        'cm': 8,
        'ca': 10,
        'cv': 7,
        'bq': 7,
        'ky': 10,
        'cf': 8,
        'td': 8,
        'cl': 9,
        'cn': 12,
        'cx': 9,
        'cc': 9,
        'co': 10,
        'km': 7,
        'cd': 9,
        'cg': 9,
        'ck': 5,
        'cr': 8,
        'ci': 10,
        'hr': 9,
        'cu': 8,
        'cw': 7,
        'cy': 11,
        'cz': 12,
        'dk': 8,
        'dj': 6,
        'dm': 10,
        'do': 10,
        'ec': 8,
        'eg': 9,
        'sv': 11,
        'gq': 9,
        'er': 7,
        'ee': 10,
        'sz': 8,
        'et': 9,
        'fk': 5,
        'fo': 6,
        'fj': 7,
        'fi': 12,
        'fr': 9,
        'gf': 9,
        'pf': 6,
        'ga': 7,
        'gm': 7,
        'ge': 9,
        'de': 13,
        'gh': 9,
        'gi': 8,
        'gr': 10,
        'gl': 6,
        'gd': 10,
        'gp': 9,
        'gu': 10,
        'gt': 8,
        'gg': 6,
        'gn': 8,
        'gw': 8,
        'gy': 7,
        'ht': 8,
        'hn': 8,
        'hk': 9,
        'hu': 9,
        'is': 9,
        'in': 10,
        'id': 10,
        'ir': 10,
        'iq': 10,
        'ie': 11,
        'im': 10,
        'il': 9,
        'it': 11,
        'jm': 10,
        'jp': 13,
        'je': 10,
        'jo': 9,
        'kz': 10,
        'ke': 10,
        'ki': 5,
        'xk': 8,
        'kw': 8,
        'kg': 9,
        'la': 10,
        'lv': 8,
        'lb': 8,
        'ls': 8,
        'lr': 8,
        'ly': 9,
        'li': 9,
        'lt': 8,
        'lu': 11,
        'mo': 8,
        'mk': 8,
        'mg': 10,
        'mw': 8,
        'my': 9,
        'mv': 7,
        'ml': 8,
        'mt': 8,
        'mh': 7,
        'mq': 9,
        'mr': 7,
        'mu': 7,
        'yt': 9,
        'mx': 10,
        'fm': 7,
        'md': 8,
        'mc': 9,
        'mn': 8,
        'me': 12,
        'ms': 10,
        'ma': 9,
        'mz': 9,
        'mm': 9,
        'na': 10,
        'nr': 7,
        'np': 9,
        'nl': 9,
        'nc': 6,
        'nz': 10,
        'ni': 8,
        'ne': 8,
        'ng': 10,
        'nu': 4,
        'nf': 6,
        'kp': 17,
        'mp': 10,
        'no': 8,
        'om': 8,
        'pk': 11,
        'pw': 7,
        'ps': 9,
        'pa': 8,
        'pg': 11,
        'py': 9,
        'pe': 11,
        'ph': 10,
        'pl': 9,
        'pt': 11,
        'pr': 10,
        'qa': 8,
        're': 9,
        'ro': 9,
        'ru': 10,
        'rw': 9,
        'bl': 9,
        'sh': 5,
        'kn': 10,
        'lc': 10,
        'mf': 9,
        'pm': 6,
        'vc': 10,
        'ws': 7,
        'sm': 10,
        'st': 7,
        'sa': 9,
        'sn': 9,
        'rs': 12,
        'sc': 7,
        'sl': 8,
        'sg': 12,
        'sx': 10,
        'sk': 9,
        'si': 8,
        'sb': 5,
        'so': 8,
        'za': 9,
        'kr': 11,
        'ss': 9,
        'es': 9,
        'lk': 9,
        'sd': 9,
        'sr': 7,
        'sj': 8,
        'se': 13,
        'ch': 12,
        'sy': 10,
        'tw': 9,
        'tj': 9,
        'tz': 9,
        'th': 9,
        'tl': 8,
        'tg': 8,
        'tk': 4,
        'to': 7,
        'tt': 10,
        'tn': 8,
        'tr': 10,
        'tm': 8,
        'tc': 10,
        'tv': 6,
        'vi': 10,
        'ug': 9,
        'ua': 9,
        'ae': 9,
        'gb': 10,
        'us': 10,
        'uy': 11,
        'uz': 9,
        'vu': 7,
        'va': 11,
        've': 10,
        'vn': 10,
        'wf': 6,
        'eh': 8,
        'ye': 9,
        'zm': 9,
        'zw': 10,
        'ax': 6,
    };

    return phoneLengths[iso2] || null;
};
// Create function which remove html tags from string
function removeHtmlTags(str) {
    if (typeof str !== 'string') {
        return str; // Return as is if not a string
    }
    return str.replace(/<\/?[^>]+(>|$)/g, ""); // Remove HTML tags
}

// replace br tag to newline
function replaceBrTags(str) {
    if (typeof str !== 'string') {
        return str; // Return as is if not a string
    }
    return str.replace(/<br\s*\/?>/gi, "\n"); // Replace <br> tags with newline
}
