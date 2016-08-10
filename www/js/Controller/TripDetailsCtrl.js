var appControllers = appControllers || angular.module('travellers.controllers', []);

appControllers.controller('TripDetailsCtrl', function ($scope,
    $location,
    $ionicModal,
    $ionicHistory,
    $ionicLoading,
    $ionicPopup) {

    var selectedMemberIDs = {},
        memberList = [],
        notifyMemberList = [];

    $scope.members = [];
    $scope.memberModal = {};

    $scope.memberModal.members = [];

    $scope.isEditable = TRVLS.Registry.isEditable;

    var getMembers = function () {
        var i = 0;
        $scope.members = [];

        $ionicLoading.show({
            template: TRVLS.Constants.FetchingMembers
        }).then(function () {
            var x = null,
                tripMemberIDs = null,
                tripMembers = null;

            TRVLS.FBUtils.getTripMembers(TRVLS.Registry.TripDetails.selectedTripID)
                .then(function (data) {
                    tripMembers = data.val();
                    tripMemberIDs = tripMembers == null ? 0 : Object.keys(tripMembers);

                    //Handle the flow with 0 members for the trip!
                    if (tripMemberIDs === 0) {
                        return firebase.Promise.resolve(null);
                    }

                    return TRVLS.FBUtils.getSpecificUserDetails(tripMemberIDs);
                }).then(function (users) {
                    if (users !== null) {
                        for (i = 0; i < users.length; i++) {
                            x = users[i].val();
                            x["id"] = tripMemberIDs[i];
                            x["status"] = TRVLS.Constants.MemberStatus[tripMembers[x["id"]].status];
                            $scope.members.push(x);
                        }
                    }
                })
                .catch(function (error) {
                    //TODO: Better error handling...
                    console.log(error);

                }).done(function () {
                    $ionicLoading.hide();
                });

        });
    };

    getMembers();

    //Currently deleting the added member is not possible!
    $scope.deleteMember = function (index) {

        $ionicLoading.show({
            template: TRVLS.Constants.DeletingMember
        }).then(function () {

            TRVLS.FBUtils.removeItem('/TripsDetails/' + TRVLS.Registry.selectedTripID + '/tMembers/' + $scope.members[index].id).then(function () {
                return notify(TRVLS.Constants.deletedFromTripNotification, TRVLS.Registry.selectedTripName, $scope.members[index].id);
            }).then(function () {
                $scope.members.splice(index, 1);
            }).catch(function (error) {
                $ionicPopup.alert({
                    title: 'Error',
                    template: error.message
                });
            }).done(function () {
                $ionicLoading.hide();
            });
        });

    };

    $scope.deleteTrip = function () {

        var tripID = TRVLS.Registry.TripDetails.selectedTripID,
            path = [],
            trip = '/Trips/' + firebase.auth().currentUser.uid + '/' + tripID,
            tripDetails = '/TripsDetails/' + tripID;


        var confirmPopup = $ionicPopup.confirm({
            title: 'Last Chance...',
            template: 'Are you sure to delete the trip?'
        });



        confirmPopup.then(function (res) {
            if (res) {

                path.push(TRVLS.FBUtils.removeItem(trip));
                path.push(TRVLS.FBUtils.removeItem(tripDetails));

                for (member in $scope.members) {
                    if ($scope.members[member].status === "Joined") {
                        path.push(TRVLS.FBUtils.removeItem('/Users/' + $scope.members[member].id + '/associatedTrips/' + tripID));
                    }
                }

                $ionicLoading.show({
                    template: 'Deleting trip'
                }).then(function () {
                    firebase.Promise.all(path).then(function () {

                    }).catch(function (error) {
                        console.log(error);

                    }).done(function () {
                        $ionicLoading.hide();
                        $location.path('/app/home');
                    });
                });
            }
        });



    };

    $scope.openMemberModal = function () {

        $ionicModal.fromTemplateUrl('templates/addMemberModal.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modal = modal;
            modal.show();

        }).catch(function (error) {
            console.log(error);
        });
    };

    $scope.memberModal.cancel = function () {
        $scope.modal.hide();
    };

    $scope.memberModal.add = function () {
        $scope.modal.hide();

        $ionicLoading.show({
            template: TRVLS.Constants.AddingMembers
        }).then(function () {
            showMembers($scope.memberModal.members)
                .then(function () {
                    return notifyJoiningTheTrip();
                })
                .then(function () {
                    $ionicLoading.hide();
                    getMembers();
                });
        });
    };

    $scope.memberModal.search = function () {

        var Members = memberList;
        $scope.memberModal.members = [];

        for (member in Members) {
            if (Members[member].firstName.toLowerCase().indexOf($scope.memberModal.srchText.toLowerCase()) == 0) {
                $scope.memberModal.members.push(Members[member]);
            }
        }

        if ($scope.memberModal.srchText.length === 0) {
            $scope.memberModal.members = Members;
        }

    };

    $scope.$on('modal.shown', function () {

        $scope.memberModal.members = [];

        $ionicLoading.show({
            template: TRVLS.Constants.FetchingMembers
        }).then(function () {

            TRVLS.FBUtils.getUsers().then(function (snapshot) {
                var users = snapshot.val();
                for (user in users) {
                    if (user !== firebase.auth().currentUser.uid) {
                        users[user]["isChecked"] = false;
                        users[user]["id"] = user;
                        $scope.memberModal.members.push(users[user]);
                    }
                }

                memberList = $scope.memberModal.members.slice(0);

            }).done(function () {
                $ionicLoading.hide();
            });

        });

    });

    var showMembers = function (members) {

            var associatedMemberIDsReq = [],
                tripID = {},
                uid = "";

            for (member in members) {

                uid = members[member]["id"];

                if (members[member]["isChecked"]) {

                    //Check if already added member to the trip. Have to refactor this logic for scalability!
                    if (!isAlreadyAdded(members[member], $scope.members)) {

                        selectedMemberIDs[uid] = {
                            "uid": uid,
                            "status": TRVLS.Constants.Pending
                        };

                        members[member]["tMembers"] = selectedMemberIDs;
                        notifyMemberList.push(uid);

                    }

                }
            }

            return TRVLS.FBUtils.updateTripDetails(TRVLS.Registry.TripDetails.selectedTripID, selectedMemberIDs);

        },
        isAlreadyAdded = function (key, list) {
            for (l in list) {
                if (list[l].firstName === key.firstName) {
                    return true;
                }
            }
            return false;
        },

        notifyJoiningTheTrip = function () {
            var id = TRVLS.FBUtils.generateNotificationID(),
                notification = {},
                notifyReq = [],
                i = 0;

            notification[id] = {
                message: TRVLS.Constants.addedToTripNotification + TRVLS.Registry.TripDetails.selectedTripName,
                tripID: TRVLS.Registry.TripDetails.selectedTripID
            };

            for (i = 0; i < notifyMemberList.length; i++) {
                notifyReq.push(TRVLS.FBUtils.publishNotifications(notifyMemberList[i], notification));
            }

            return firebase.Promise.all(notifyReq);
        };


});
