<template>
  <div class="embed-map" id="map"></div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, PropType, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import { GymLocation, LatLong } from '@/common/api/route/getGymsByCountry';

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
      type: Array as PropType<Array<GymLocation>>,
      required: true,
    },
    mapLocation: {
      type: String,
      required: true,
    },
  },
  emits: ['update:clickedGymLocation'],
  setup(props, { emit }) {
    mapboxgl.accessToken = process.env.VUE_APP_MAPBOX_ACCESS_KEY as string;

    let map: mapboxgl.Map;

    const gymLocationsGeoJson = computed(() => {
      let locationJson: Feature[] = [];
      props.gymLocationList.forEach((gymLocation, index) => {
        locationJson.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [gymLocation.latLong.longitude, gymLocation.latLong.latitude],
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

    watch(
      () => props.mapLocation,
      () => {
        const [lat, lng] = props.mapLocation.split(',').map(parseFloat) as [number, number];
        map.flyTo({
          center: [lng, lat],
          zoom: 16,
        });
        const coordsLatLong: LatLong = {
          latitude: lat,
          longitude: lng,
        };
        const matchingGymLocations = props.gymLocationList.filter((gymLocation) =>
          latLongAreEqual(gymLocation.latLong, coordsLatLong),
        );
        if (matchingGymLocations.length) {
          createPopUp(matchingGymLocations[0].gymName, [lng, lat]);
        }
      },
    );

    const createPopUp = (gymName: string, lngLat: [number, number]) => {
      /* Close all other popups and display popup for clicked store */
      const popUps = document.getElementsByClassName('mapboxgl-popup');
      /** Check if there is already a popup on the map and if so, remove it */
      if (popUps[0]) {
        popUps[0].remove();
      }
      new mapboxgl.Popup({ closeOnClick: false })
        .setLngLat(lngLat)
        .setHTML(`<h3 style="color: black;">${gymName}</h3>`)
        .addTo(map);
    };

    const latLongAreEqual = (a: LatLong, b: LatLong) => {
      return a.latitude === b.latitude && a.longitude === b.longitude;
    };

    onMounted(() => {
      const [lat, lng] = props.mapLocation.split(',').map(parseFloat);
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lng, lat],
        zoom: 16,
      });
      map.on('load', () => {
        map.loadImage('assets/mapbox-marker.png', (error, image) => {
          if (image && !error) {
            map.addImage('custom-marker', image);
            map.addSource('gyms', {
              type: 'geojson',
              data: gymLocationsGeoJson.value,
            });
            map.addLayer({
              id: 'locations',
              type: 'symbol',
              source: 'gyms',
              layout: {
                'icon-image': 'custom-marker',
              },
            });
            const coordsLatLong: LatLong = {
              latitude: lat,
              longitude: lng,
            };
            const matchingGymLocations = props.gymLocationList.filter((gymLocation) =>
              latLongAreEqual(gymLocation.latLong, coordsLatLong),
            );
            if (matchingGymLocations.length) {
              createPopUp(matchingGymLocations[0].gymName, [lng, lat]);
            }
          }
        });
      });
      map.on('click', (event) => {
        /* Determine if a feature in the "locations" layer exists at that point. */
        const features = map.queryRenderedFeatures(event.point, {
          layers: ['locations'],
        });

        /* If yes, then: */
        if (features.length) {
          const clickedPoint = features[0];

          /* Fly to the point */
          const coords = (clickedPoint.geometry as Geometry).coordinates;
          map.flyTo({
            center: coords,
            zoom: 16,
          });

          emit(
            'update:clickedGymLocation',
            props.gymLocationList[clickedPoint.properties?.id].gymLocation,
          );

          createPopUp(clickedPoint.properties?.gymName, coords);
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
.mapboxgl-popup {
  top: -30px !important;
}

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
