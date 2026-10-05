import { LocationPreset } from '../types';

export const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: 'abu-dhabi',
    name: 'Abu Dhabi, United Arab Emirates',
    description: 'Modern capital of the UAE, featuring futuristic architecture and spectacular coastal islands.',
    longitude: 54.3773,
    latitude: 24.4539,
    height: 1200,
    pitch: -30,
    heading: 0,
    roll: 0
  },
  {
    id: 'nyc',
    name: 'Manhattan, New York City',
    description: 'Breathtaking 3D skyscrapers, Central Park, and the Hudson River.',
    longitude: -74.0060,
    latitude: 40.7128,
    height: 1200,
    pitch: -35,
    heading: 0,
    roll: 0
  },
  {
    id: 'grand-canyon',
    name: 'Grand Canyon, USA',
    description: 'Spectacular depth and erosion detail. Best with 3D terrain enabled.',
    longitude: -112.1130,
    latitude: 36.1070,
    height: 3500,
    pitch: -25,
    heading: 0,
    roll: 0
  },
  {
    id: 'everest',
    name: 'Mount Everest, Nepal',
    description: 'The highest peak on Earth. Experience extreme elevation scale.',
    longitude: 86.9250,
    latitude: 27.9881,
    height: 10500,
    pitch: -20,
    heading: 0,
    roll: 0
  },
  {
    id: 'tokyo',
    name: 'Tokyo, Japan',
    description: 'A sprawling neon megalopolis with extensive 3D structural density.',
    longitude: 139.6917,
    latitude: 35.6895,
    height: 1500,
    pitch: -30,
    heading: 0,
    roll: 0
  },
  {
    id: 'paris',
    name: 'Paris, France',
    description: 'The City of Light. Iconic grid, Eiffel Tower, and historic monuments.',
    longitude: 2.2945,
    latitude: 48.8584,
    height: 800,
    pitch: -35,
    heading: 0,
    roll: 0
  },
  {
    id: 'sydney',
    name: 'Sydney, Australia',
    description: 'Stunning harbor, Opera House, and Harbour Bridge in 3D.',
    longitude: 151.2153,
    latitude: -33.8568,
    height: 900,
    pitch: -25,
    heading: 0,
    roll: 0
  },
  {
    id: 'giza',
    name: 'Giza Pyramids, Egypt',
    description: 'Historic pyramids rising from the desert sands.',
    longitude: 31.1342,
    latitude: 29.9792,
    height: 600,
    pitch: -20,
    heading: 0,
    roll: 0
  },
  {
    id: 'alps',
    name: 'The Alps, Chamonix',
    description: 'Charming valley surrounded by towering snow-capped mountain walls.',
    longitude: 6.8686,
    latitude: 45.9227,
    height: 4800,
    pitch: -18,
    heading: 0,
    roll: 0
  }
];

export const GLOBAL_HOME_PRESET: LocationPreset = {
  id: 'global-home',
  name: 'Global Home',
  description: 'High-altitude orbit perspective of Planet Earth.',
  longitude: 0.0,
  latitude: 20.0,
  height: 15000000.0,
  heading: 0.0,
  pitch: -90.0,
  roll: 0.0
};

