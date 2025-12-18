// items.js
// 아이템 DB는 "key"만 바꾸면 자동으로 이미지 경로가 붙는 구조.
// 네이밍 규칙(라벨링):
//  - 얼굴(포트레이트) 레이어: images/face_<layerCode>_<key>.png
//  - 바디(미니캐릭터) 레이어: images/body_<layerCode>_<key>.png
// 예) 빨간 리본(h): face_h_red_ribon.png / body_h_red_ribon.png
// 예) 수트(b):      face_b_suit.png      / body_b_suit.png

function buildLayerAsset(layerCode, key) {
  return {
    faceLabel: `face_${layerCode}_${key}`,
    bodyLabel: `body_${layerCode}_${key}`,
    faceImg: `images/face_${layerCode}_${key}.png`,
    bodyImg: `images/body_${layerCode}_${key}.png`,
  };
}

// 필요한 것만 남긴 최소 아이템 DB(추가할 때 아래 형식 그대로 복사)
const itemDB = {
  "Red_Ribbon": {
    name: "빨간 리본",
    type: "hat",
    price: 20,
    layerCode: "h",
    key: "red_ribon",
    effect: () => appendLog("빨간 리본을 착용했다.")
  },

  "Luxury_Suit": {
    name: "수트",
    type: "outfit",
    price: 200,
    layerCode: "b",
    key: "suit",
    effect: () => appendLog("수트를 착용했다.")
  },
};

// ✅ 자동으로 faceImg/bodyImg를 붙여준다 (추후 아이템 추가해도 동일)
Object.keys(itemDB).forEach((id) => {
  const it = itemDB[id];
  if (it && it.layerCode && it.key) {
    Object.assign(it, buildLayerAsset(it.layerCode, it.key));
  }
});

// 외부에서 쓰기
window.itemDB = itemDB;
window.buildLayerAsset = buildLayerAsset;
