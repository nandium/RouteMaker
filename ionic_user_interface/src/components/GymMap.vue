<template>
  <div class="embed-map" id="map"></div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted } from 'vue';
import mapboxgl from 'mapbox-gl';
import { GymLocation } from '@/common/api/route/getGymsByCountry';

interface Geometry {
  type: 'Point';
  coordinates: [number, number];
}

interface Feature {
  type: 'Feature';
  geometry: Geometry;
  properties: {
    gymName: string;
    id: number;
  };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export default defineComponent({
  name: 'GymMap',
  props: {
    gymLocationList: {
      type: Array,
      required: true,
    },
    currentGymLocation: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    mapboxgl.accessToken = process.env.VUE_APP_MAPBOX_ACCESS_KEY as string;

    const gymLocationsGeoJson = computed(() => {
      let locationJson: Feature[] = [];
      (props.gymLocationList as GymLocation[]).forEach((gymLocation, index) => {
        const [lat, lng] = gymLocation.gymLocation.split(',').map(parseFloat);
        locationJson.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          properties: {
            gymName: gymLocation.gymName,
            id: index,
          },
        });
      });
      return {
        type: 'FeatureCollection',
        features: locationJson,
      } as FeatureCollection;
    });

    onMounted(() => {
      const [lat, lng] = props.currentGymLocation.split(',').map(parseFloat);
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lng, lat],
        zoom: 16,
      });
      map.on('load', () => {
        map.addLayer({
          id: 'locations',
          type: 'circle',
          source: {
            type: 'geojson',
            data: gymLocationsGeoJson.value,
          },
        });
      });
      map.on('click', (event) => {
        /* Determine if a feature in the "locations" layer exists at that point. */
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['locations'],
        });

        /* If yes, then: */
        if (features.length) {
          var clickedPoint = features[0];

          /* Fly to the point */
          map.flyTo({
            center: (clickedPoint.geometry as Geometry).coordinates,
            zoom: 16,
          });

          /* Close all other popups and display popup for clicked store */
          var popUps = document.getElementsByClassName('mapboxgl-popup');
          /** Check if there is already a popup on the map and if so, remove it */
          if (popUps[0]) popUps[0].remove();

          new mapboxgl.Popup({ closeOnClick: false })
            .setLngLat((clickedPoint.geometry as Geometry).coordinates)
            .setHTML(`<h3 style="color: black;">${clickedPoint.properties?.gymName}</h3>`)
            .addTo(map);

          /* Highlight listing in sidebar (and remove highlight for all other listings) */
          const activeItem = document.getElementsByClassName('active');
          if (activeItem[0]) {
            activeItem[0].classList.remove('active');
          }
          const listing = document.getElementById('listing-' + clickedPoint.properties?.id);
          listing?.classList.add('active');
        }
      });
    });
  },
});
</script>

<style scoped lang="scss">
body.dark .embed-map {
  border: 0;
  filter: invert(90%);
}

body .embed-map {
  border: 0;
}

.embed-map {
  width: min(100vw, 800px);
  height: min(100vw, 800px);
  margin: 0 auto;
}
</style>

<style>
/* This style section has to be unscoped due to mapbox being from an external source */
/* Marker tweaks */
.mapboxgl-popup-close-button {
  display: none;
}

.mapboxgl-popup-content {
  font: 400 15px/22px 'Source Sans Pro', 'Helvetica Neue', Sans-serif;
  padding: 0;
  width: 180px;
}

.mapboxgl-popup-content-wrapper {
  padding: 1%;
}

.mapboxgl-popup-content h3 {
  background: #91c949;
  color: #fff;
  margin: 0;
  display: block;
  padding: 10px;
  border-radius: 3px 3px 0 0;
  font-weight: 700;
  margin-top: -15px;
}

.mapboxgl-popup-content h4 {
  margin: 0;
  display: block;
  padding: 10px;
  font-weight: 400;
}

.mapboxgl-popup-content div {
  padding: 10px;
}

.mapboxgl-container .leaflet-marker-icon {
  cursor: pointer;
}

.mapboxgl-popup-anchor-top > .mapboxgl-popup-content {
  margin-top: 15px;
}

.mapboxgl-popup-anchor-top > .mapboxgl-popup-tip {
  border-bottom-color: #91c949;
}
</style>
