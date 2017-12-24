$(function(){

	var viewerEl = document.body;
	var viewer = new Viewer(viewerEl, './db');
	viewer.loadDatabase(function(){
		viewer.init();
	});

});

function Viewer( el, dbUrl ) {

	this._el = el;
	this._dbUrl = dbUrl;

	this._mapEl = this._el.querySelector('.map');
	this._legendEl = this._el.querySelector('.legend');
	this._popupInfoEl = this._el.querySelector('.popup-info');
	this._layersListEl = this._el.querySelector('.sidebar ul.layers');
	this._layers = {};

}

Viewer.prototype.loadDatabase = function( callback ) {
	$.getJSON( this._dbUrl + '/index.json', function(data){
		this._db = data;
		callback();
	}.bind(this));
}

Viewer.prototype.init = function(){

	this._view = new ol.View({
		center: ol.proj.transform([6.1552, 52.2661], 'EPSG:4326', 'EPSG:3857'), // Deventer, The Netherlands
		zoom: 8
	});

	var layers = this._db.layers.map(function(layer, index){

		var layerInstance;
		var c;
		var source;
		var id = layer.id;
		var visible = ( typeof layer.visible === 'boolean' ) ? layer.visible : true;
		var opacity = ( typeof layer.opacity === 'number' ) ? layer.opacity : 1;

		if( layer.type === 'osm' ) {
			c = ol.layer.Tile;
			source = new ol.source.OSM({
		        crossOrigin: 'anonymous'
		    });
		}

		if( layer.type === 'wms' ) {
			c = ol.layer.Image;
			source = new ol.source.ImageWMS(layer.wms);
		}

		var layerEl = document.createElement('li');
			layerEl.dataset.id = id;
			layerEl.classList.add('layer');
			layerEl.addEventListener('mouseover', function(){
				this.setLegendUrl( layer.legendUrl );
			}.bind(this));
			layerEl.addEventListener('mouseout', function(){
				this.setLegendUrl( null );
			}.bind(this));
		this._layersListEl.appendChild(layerEl);

		var layerSummaryEl = document.createElement('div');
			layerSummaryEl.classList.add('summary');
		layerEl.appendChild(layerSummaryEl);

		var layerOptionsEl = document.createElement('div');
			layerOptionsEl.classList.add('options');
		layerEl.appendChild(layerOptionsEl);

		var handleEl = document.createElement('i');
			handleEl.classList.add('handle', 'fa', 'fa-bars');
		layerSummaryEl.appendChild(handleEl);

		var layerCheckboxEl = document.createElement('input');
			layerCheckboxEl.id = 'layer-checkbox-' + id;
			layerCheckboxEl.type = 'checkbox';
			if( visible ) layerCheckboxEl.checked = 'checked';
			layerCheckboxEl.addEventListener('change', function(e){
				layerInstance.setVisible( layerCheckboxEl.checked );
			});
		layerSummaryEl.appendChild(layerCheckboxEl);

		/*
		var iconEl = document.createElement('i');
			iconEl.classList.add('icon', 'fa', 'fa-map');
		layerEl.appendChild(iconEl);
		*/

		var nameEl = document.createElement('label');
			nameEl.htmlFor = layerCheckboxEl.id;
			nameEl.classList.add('name');
			nameEl.textContent = layer.name;
		layerSummaryEl.appendChild(nameEl);

		if( layer.infoUrl ) {
			var infoIconEl = document.createElement('i');
				infoIconEl.classList.add('info', 'fa', 'fa-info-circle');
				infoIconEl.addEventListener('click', function(){
					$.get( this._dbUrl + '/' + layer.infoUrl, function(html){
						this._showInfo( html );
					}.bind(this));
				}.bind(this));
			layerSummaryEl.appendChild(infoIconEl);
		}

		var sliderIconEl = document.createElement('i');
			sliderIconEl.classList.add('slider', 'fa', 'fa-sliders');
			sliderIconEl.addEventListener('mousedown', function(){
				layerEl.classList.toggle('expanded');
				sliderEl.focus();
			}.bind(this));
		layerSummaryEl.appendChild(sliderIconEl);

		var sliderEl = document.createElement('input');
			sliderEl.type = 'range';
			sliderEl.min = 0;
			sliderEl.max = 1;
			sliderEl.step = 0.01;
			sliderEl.value = opacity;
			sliderEl.addEventListener('input', function(){
				layerInstance.setOpacity( sliderEl.value );
			}.bind(this));
			sliderEl.addEventListener('change', function(){
				layerInstance.setOpacity( sliderEl.value );
				sliderEl.blur();
			}.bind(this));
		layerOptionsEl.appendChild(sliderEl);

		layerInstance = new c({
			id: id,
			source: source
		});

		layerInstance.setZIndex( this._db.layers.length - index );
		layerInstance.setVisible( visible )
		layerInstance.setOpacity( opacity );

		this._layers[id] = {
			instance: layerInstance,
			source: source,
		}

		return layerInstance;

	}.bind(this));

	this._initSortable();
	this._initInfo();

	this._map = new ol.Map({
		layers: layers,
		target: this._el,
		controls: ol.control.defaults({
			attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
				collapsible: false
			})
		}),
		view: this._view
	});

	this._map.on('singleclick', this._onSingleClick.bind(this));

}

Viewer.prototype._onSingleClick = function(e) {

	for( var layerId in this._layers ) {
		(function(){
			var layer = this._layers[layerId];
			if( !layer.source.getGetFeatureInfoUrl ) return;
			if( !layer.instance.getVisible() ) return;

			var viewResolution = this._view.getResolution();

			// HTML popup, less fancy
			var url = layer.source.getGetFeatureInfoUrl(e.coordinate, viewResolution, 'EPSG:3857',	{
				'INFO_FORMAT': 'text/html'
			});
			if( url ) window.open(url, 'popup-' + layerId, 'width=600,height=600');

			// JSON popup, fancy but incomplete
			/*
			var url = layer.source.getGetFeatureInfoUrl(e.coordinate, viewResolution, 'EPSG:3857',	{
				'INFO_FORMAT': 'application/json'
			});
			if( !url ) return;

			$.getJSON(url, function(data){
				if( !data ) return;

				console.log('data', data)

				// wtf coordinate system they're using?
				// if( Array.isArray(data.features) ) {
				//  data.features.forEach(function(feature){
				//  	if( feature.geometry && feature.geometry.coordinates ) {
				//  		var vector = new ol.layer.Vector({
				//  			features: [
				//  				new ol.Feature({
				//  				    name: "Polygon",
				//  				    geometry: new ol.geom.MultiPolygon( feature.geometry.coordinates )
				//  				})
				//  			]
				//  		});
				//  		this._map.addLayer(vector);
				//  	}
				//  }.bind(this));
				// }
			}.bind(this))
			*/
		}.bind(this))();
	}
}

Viewer.prototype._initSortable = function() {
	$(function(){
		$(this._layersListEl).sortable({
			handle: '.handle',
			scroll: false,
			axis: 'y',
			update: function( e, ui ) {
		        $(e.target).sortable('toArray', {
			        attribute: 'data-id'
		        }).forEach(function(id, index){
			        this._layers[id].instance.setZIndex( Object.keys(this._layers).length - index );
		        }.bind(this));
			}.bind(this)
		})
	}.bind(this));
}

Viewer.prototype._initInfo = function(){
	this._popupInfoEl.querySelector('.close').addEventListener('click', function(){
		this._hideInfo();
	}.bind(this));
}

Viewer.prototype._showInfo = function( html ){
	this._popupInfoEl.querySelector('.content').innerHTML = html;
	this._popupInfoEl.classList.add('visible');
}

Viewer.prototype._hideInfo = function(){
	this._popupInfoEl.classList.remove('visible');
}

Viewer.prototype.setLegendUrl = function( url ) {
	this._legendEl.classList.toggle('visible', typeof url === 'string');
	if( url ) this._legendEl.src = url;
}