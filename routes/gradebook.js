var mdb = require('../mdb');
var gitBackend = require('./git');
var request = require('request');
var pug = require('pug');
var path = require('path');
var OAuth = require('oauth-1.0a');
var config = require('../config');
var crypto  = require('crypto');

var passback = pug.compileFile(path.join(__dirname,'../views/lti/passback.pug'));

exports.record = function(req, res, next) {
    var repositoryName = gitBackend.normalizeRepositoryName(req.params.repository);

    if (!req.user) {
	next('No user logged in.');
    } else {
	mdb.LtiBridge.find( {user: req.user._id}, function(err, bridges) {
	    if (err) {
		next(err);
	    } else {
		res.status(200).send(bridges);
		bridges = bridges.filter( function(bridge) {
		    console.log(bridge);
		    if (bridge.data.custom_repository === undefined)
			return false;
		    if (req.params.repository != gitBackend.normalizeRepositoryName( bridge.data.custom_repository ))
			return false;
		    if (bridge.data.custom_xourse === undefined)
			return false;		    
		    if (req.params.path != bridge.data.custom_xourse )
			return false;
		    return true;
		});

		bridges.forEach( function(bridge) {
		    var pointsPossible = parseInt(bridge.data.custom_canvas_assignment_points_possible);
		    var resultScore = parseFloat(req.body.pointsEarned) / parseFloat(req.body.pointsPossible);
		    var resultTotalScore = resultScore * pointsPossible;

		    var pox = passback({
			resultScore: resultScore,
			resultTotalScore: resultTotalScore,
			sourcedId: bridge.data.lis_result_sourcedid
		    });

		    var url = bridge.data.ext_ims_lis_basic_outcome_url;
		    
		    var token = {
			key: bridge.data.oauth_consumer_key,
			secret: config.lti.secret
		    };

		    if (token.key != config.lti.key) {
			// BADBAD: error handling?
		    }

		    var requestData = {
			url: url,
			method: 'POST',
			data: pox
		    };

		    var oauth = OAuth({
			consumer: token,
			signature_method: bridge.data.oauth_signature_method,
			hash_function: function(base_string, key) {
			    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
			}
		    });		    
		    
		    request.post({
			url: url,
			form: pox,
			headers: oauth.toHeader(oauth.authorize(requestData, token))
		    }, function(error, response, body) {
			console.log(response);
			//process your data here 
		    });
		});
	    }
	});
    }
};
