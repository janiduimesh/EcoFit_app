// Map bin types to image assets
export const getBinImage = (binType: string) => {
  const binImageMap: { [key: string]: any } = {
    'recycling': require('../src/blue_bin.png'),
    'blue_bin': require('../src/blue_bin.png'),
    'general': require('../src/yel_bin.png'),
    'yellow_bin': require('../src/yel_bin.png'),
    'organic': require('../src/gr_bin.png'),
    'green_bin': require('../src/gr_bin.png'),
    'hazardous': require('../src/black_bin.png'),
    'black_bin': require('../src/black_bin.png'),
    'electronic': require('../src/red_bin.png'),
    'red_bin': require('../src/red_bin.png'),
  };
  
  // Normalize bin type (lowercase, handle underscores)
  const normalizedType = binType?.toLowerCase().replace(/_/g, '_') || 'general';
  
  return binImageMap[normalizedType] || binImageMap['general'];
};
