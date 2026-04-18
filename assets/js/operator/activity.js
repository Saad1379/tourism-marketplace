$(document).ready(function() {
    $("#p_loader").addClass("d-none");
    setActivityList();
});

function setActivityList() {
    filterPaginationData("/activity-list", "table-data", "pagination_table_view");
};
