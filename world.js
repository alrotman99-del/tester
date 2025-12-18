// world.js
// 맵/이벤트/서사는 최소화하고, 구매/착용 플로우만 남김.

const nodes = {
  home: {
    text: "집이다.",
    choices: [
      { label: "외출하기", timeCost: 5, action: () => { state.location = "outside"; }, go: "outside" },
      { label: "소지품 확인", timeCost: 0, go: "inventory" },
    ]
  },

  inventory: {
    text: "가방 안을 확인합니다.",
    choices: () => {
      const list = [];
      state.inventory.forEach(itemId => {
        const item = itemDB[itemId];
        list.push({
          label: `[사용/장착] ${item ? item.name : itemId}`,
          action: () => useItem(itemId),
          go: "inventory"
        });
      });
      list.push({ label: "닫기", go: state._lastNode || "home" });
      return list;
    }
  },

  outside: {
    text: "거리다.",
    choices: [
      { label: "집으로", timeCost: 5, action: () => { state.location = "home"; }, go: "home" },
      { label: "상점", timeCost: 10, go: "shop" },
      { label: "소지품", timeCost: 0, go: "inventory" },
    ]
  },

  shop: {
    text: "작은 상점이다.",
    choices: [
      { label: "🎀 빨간 리본 (20)", action: () => buy("Red_Ribbon", 20), go: "shop" },
      { label: "👔 수트 (200)", action: () => buy("Luxury_Suit", 200), go: "shop" },
      { label: "밖으로", go: "outside" },
    ]
  },
};

window.nodes = nodes;
