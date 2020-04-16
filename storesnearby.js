$(document).ready(function () {
    var log = console.log;
    var retryCount = 0;
    var tokenUrl = "https://api.kroger.com/v1/connect/oauth2/token";

    var token = localStorage.getItem('token') || "";
    $("#store-name").text('');

    // On submit of user search query
    $("#search").on('click', function (event) {
        event.preventDefault();
        
        let userInputProduct = $("#product").val().trim(),
            userInputZipCode = $("#zipcode").val().trim();
        const limitMiles = 15;
        if (!isDataInvalid(userInputProduct, userInputZipCode)) {
            $("#productdetails").empty();
            fetchLocationIds(userInputZipCode, limitMiles, userInputProduct);
        }
    });

    async function refreshToken() {
        try {
            const response = await $.ajax({
                url: tokenUrl,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization:
                        "Basic Y29vbHN0b3JlbmVhcmJ5LTM5YTJhZGU1N2NjMmQyMjA4OGI4NjZjYzk4MjcwZGFmNTc0NzQxNzg5MDgwMDAwMjAzNTpwTEtEODQ4UXZMRlg4akdzbUVUQVBHRmhFSEdaVlliMXpDcm8zSUFt",
                },
                data: {
                    grant_type: "client_credentials",
                    scope: "product.compact",
                },
            })
            token = response.access_token;
            localStorage.setItem("token", token);
        } catch (error) {
            log("error: ", error);
        }
    }

    async function retryStrategyForProductSearchApi(error, userInputProduct, locationId) {
        var statusCode = error.status || 500;
        if (statusCode === 401 && retryCount < 2) {
            retryCount++;
            // Async Await
            await refreshToken(); // 1
            await fetchProducts(userInputProduct, locationId); // 2
        }
    }

    async function retryStrategyForLocationIdsApi(error, zipCode, limitMiles) {
        var statusCode = error.status || 500;
        if (statusCode === 401 && retryCount < 2) {
            retryCount++;
            // Async Await
            await refreshToken(); // 1
            return await fetchLocationIds(zipCode, limitMiles); // 2
        }
    }

    function fetchProducts(userInputProduct, locationId) {
        // Get the products from Kroger API
        var productUrl = "https://api.kroger.com/v1/products?filter.term=" + userInputProduct + "&filter.locationId=" + locationId;

        $.ajax({
            url: productUrl,
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token,
            },
        })
            .then(function (response) {
                retryCount = 0;
                log("Data: ", response);
                appendProductsToDisplay(response);
            })
            .catch((error) => retryStrategyForProductSearchApi(error, userInputProduct, locationId));
    }

    function appendProductsToDisplay(response) {
        let row = $("<div class='row'>");
        //const recordsPerPage = 4;
        //let totalRecords = response.data.length;
        //let numberOfPages = parseInt(totalRecords / recordsPerPage);
        
        for (var i = 0; i < response.data.length; i++) {
            let cols12m6 = $("<div class='col s12 m6'>");
            let cardPanel = $("<div class='card card-panel hoverable blue lighten-5'>");
            let cardContent = $("<div class='card-content'>");
            let cardAction = $("<div class='card-action'>")
                .append("<a class='waves-effect btn blue lighten-1 left'><i class='material-icons left'>save</i>Wishlist</a>");
            let shopBtn = $("<a class='waves-effect btn blue lighten-1 right'><i class='material-icons left'>send</i>Shop</a>");
            shopBtn.attr("id", "productLink-" + i);
            generateProductUrl(response, i);
            cardAction.append(shopBtn);
            let spanCardTitle = $("<span class='card-title'>");
            let pTag = $("<p>");

            let regularPrice = "$" + response.data[i].items[0].price.regular;
            let itemDescription = response.data[i].description;

            spanCardTitle.text(regularPrice);
            pTag.text(itemDescription);

            cardContent.append(spanCardTitle);
            cardContent.append(pTag);

            let img = createImgeEl(response.data[i].productId);

            cardPanel.append(cardContent);
            cardPanel.append(img);
            cardPanel.append(cardAction);

            cols12m6.append(cardPanel);
            row.append(cols12m6);

            $("#productdetails").append(row);
        }
    }

    function generateProductUrl(response, productlinkID) {
        const productName = response.data[productlinkID].description;

        const productId = response.data[productlinkID].productId;
        const result = productName
            .toLowerCase()
            .replace(/[^0-9,^a-z,^ ]/g, "")
            .replace(/ +/g, '-');
        const url = `https://www.kroger.com/p/${result}/${productId}`;

        redirectProductUrl(url, productlinkID);
    }

    function redirectProductUrl(url, productlinkID) {
        const productAtag = $("#productLink-" + productlinkID);
        $(productAtag).attr("href", url)
    }

    function createImgeEl(productId) {
        let imageurl = "https://www.kroger.com/product/images/small/front/" + productId;
        return $("<img>").attr("src", imageurl);
    }

    // Fetch Location IDs API call
    function fetchLocationIds(zipCode, limitMiles, userInputProduct) {
        let locationIds = [];
        token = localStorage.getItem('token') || "";
        $.ajax({
            "url": "https://api.kroger.com/v1/locations?filter.zipCode.near=" + zipCode + "&filter.radiusInMiles=" + limitMiles,
            "method": "GET",
            "headers": {
                "Accept": "application/json",
                "Authorization": "Bearer " + token,
            }
        })
            .then(function (response) {

                //$("#chain").append("<strong>" + response.data[0].chain + "</strong>");

                $("#store-name").text('Kroger');

                for (let index = 0; index < response.data.length - 1; index++) {
                    locationIds.push(response.data[index].locationId);
                    console.log(locationIds[index]);
                }

                // After getting Location IDs call Product API for each location ID and our search item
                //console.log(locationIds);
                if (locationIds.length !== 0) {
                    locationIds.forEach(locationId => {
                        fetchProducts(userInputProduct, locationId);
                    });
                }
            })
            .catch((error) => {
                localStorage.clear();
                locationIds = retryStrategyForLocationIdsApi(error, zipCode, limitMiles)
            });
    }
});