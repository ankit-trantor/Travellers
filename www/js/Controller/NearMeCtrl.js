var appControllers = appControllers || angular.module('travellers.controllers', []);

appControllers.controller('NearMeCtrl', function ($scope, $ionicLoading, $ionicPopup) {

    $scope.items = [];
    $scope.markers = [];

    $ionicLoading.show({
        template: TRVLS.Constants.FetchingPlaces
    }).then(function () {

        TRVLS.Device.getUserLocation().then(function (location) {

            var latLng = new google.maps.LatLng(location.latitude, location.longitude),

                service = null,
                marker = null,


                mapOptions = {
                    center: latLng,
                    zoom: 13,
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                },

                request = {
                    location: latLng,
                    radius: '2000',
                    types: TRVLS.Constants.LocationTypes
                };

            $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);

            marker = new google.maps.Marker({
                position: latLng,
                title: 'You'
            });

            marker.setMap($scope.map);

            service = new google.maps.places.PlacesService($scope.map);
            service.nearbySearch(request, callback);

            function callback(results, status) {
                if (status == google.maps.places.PlacesServiceStatus.OK) {
                    $scope.items = results;
                }
                $ionicLoading.hide();
            }
        }).catch(function (error) {
            $ionicLoading.hide();
            $ionicPopup.alert({
                title: 'Oops..',
                template: error.message
            });
        });

    });

    function createMarker(place) {

        clearMarker($scope.markers);

        var marker = TRVLS.GMapsUtils.createMarker(place, $scope.map);

        if (marker !== undefined) {
            $scope.markers.push(marker);
        }
    }

    function clearMarker(markers) {
        for (var i = 0; i < markers.length; i++) {
            markers[i].setMap(null);
        }
    }

    $scope.placesClicked = function (index) {
        createMarker($scope.items[index]);
    };



});
