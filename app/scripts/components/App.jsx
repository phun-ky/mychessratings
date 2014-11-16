/** @jsx React.DOM */

var React = require('react');
var _ = require('lodash');
var RegisterView = require('./RegisterView');
var RatingsView = require('./RatingsView');

var ReactFireMixin = require('reactfire');
var Firebase = require('firebase');
var glicko2 = require ('glicko2');

var glicko2Settings = {
  // tau : "Reasonable choices are between 0.3 and 1.2, though the system should
  //       be tested to decide which value results in greatest predictive accuracy."
  tau : 0.5,
  // rating : default rating
  rating : 1500,
  //rd : Default rating deviation
  //     small number = good confidence on the rating accuracy
  rd : 200,
  //vol : Default volatility (expected fluctation on the player rating)
  vol : 0.06
};

var App = React.createClass({
  mixins: [ReactFireMixin],

  getInitialState: function() {
    this.players = {};
    this.games = [];
    this.ranking = new glicko2.Glicko2(glicko2Settings);
    
    return { players: {},
             games: [],
             ranking: {}
           };
  },

  componentWillMount: function() {
    this.firebasePlayersRef = new Firebase("https://glaring-torch-1034.firebaseio.com/mychessratings/players");
    this.firebasePlayersRef.on("child_added", function(snapshot) {
      var player = snapshot.val();
      player.ratings = {};
      player.ratings.glicko2 = this.ranking.makePlayer( glicko2Settings.rating,
                                                        glicko2Settings.rd,
                                                        glicko2Settings.vol);
      this.players[player.name] = player;
      this.setState({ players: this.players });
    }.bind(this));

    this.firebaseGamesRef = new Firebase("https://glaring-torch-1034.firebaseio.com/mychessratings/games");
    this.firebaseGamesRef.on("child_added", function(snapshot) {
      var game = snapshot.val();
      this.rateGame(game);
      this.games.push(game);
      this.setState({ games: this.games });
      console.log("Game rated?", game.rated);
    }.bind(this));
  },

  componentWillUnmount: function() {
    this.firebaseGamesRef.off();
    this.firebasePlayersRef.off();
  },

  addPlayer: function(player) {
    this.firebasePlayersRef.push(player);
    console.log("addPlayer", player, this.state.players);
  },

  addGame: function(game) {
    this.firebaseGamesRef.push(game);
    console.log("addGame", game);
  },

  sortGames: function() {
    return _.chain(this.state.games)
                      .sortBy(function(game) {
                         return game.timestamp;
                      })
                      .value();
  },

  translateResult: function(result) {
    switch (result) {
      case "1-0":
        return 1;
        break;
      case "0.5":
        return 0.5;
        break;
      case "0-1":
        return 0;
        break;
      default:
        console.log("Translate result failed. Could not translate", result);
    } 

  },

  isRated: function(game) {
    return (game.rated != undefined && game.rated == true)
  },

  rateGame: function(game) {
    console.log("Rate single game", game);

    var matches = [];

      if (game !== undefined && !this.isRated(game)) {
        console.log("\t" + "Rating", game);
        var result = this.translateResult(game.result);
        var white = this.state.players[game.white].ratings.glicko2;
        var black = this.state.players[game.black].ratings.glicko2;

        matches.push([white, black, result]);
      }
      
    this.ranking.updateRatings(matches);
    game.rated = true;

    this.setState({players: this.state.players});
  },

  rateGames: function() {
    console.log("Rate multiple games");
    var games = this.sortGames();

    // For each game, rate players based on result. Update player state.
    var matches = [];

    for (var index in games) {
      var game = games[index];
      if (game !== undefined && !this.isRated(game)) {
        console.log("\t" + "Rating", game);
        var result = this.translateResult(game.result);
        var white = this.state.players[game.white].ratings.glicko2;
        var black = this.state.players[game.black].ratings.glicko2;
        game.rated = true;

        matches.push([white, black, result]);
      }
      
    }
    this.ranking.updateRatings(matches);
    this.setState({players: this.state.players});
  },
  
  render: function() {

    return (
      <div>
        <RatingsView rateGames={this.rateGames} players={this.state.players} />
        <RegisterView addPlayer={this.addPlayer} addGame={this.addGame}/>
      </div>
  );}

  
});

module.exports = App;