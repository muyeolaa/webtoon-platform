{
titleListMap: { Sunday: [{},{}], Monday:[{},{}], Tuesday:[{},{}]}....}
}

{
title:{A:[{a:1,b:1,c:1},{a:2,b:2,c:2}], B:[{a:3,b:3,c:3},{a:4,b:4,c:4}]}
}


{a:1,b:1,c:1,key:A}{a:2,b:2,c:2,key:A}{a:3,b:3,c:3,key:B}{a:4,b:4,c:4 ,key:B}

const data = [
  ["A요일", ["웹툰1", "웹툰2"]], 
  ["B요일", ["웹툰3"]]
];

const result = data.map(([day, list]) => {
  // --- 대리인 1 (겉쪽 map) ---
  // 재료: ["A요일", ["웹툰1", "웹툰2"]]
  // day: "A요일", list: ["웹툰1", "웹툰2"]

  return list.map(webtoon => {
    // --- 대리인 2 (안쪽 map) ---
    // 재료: "웹툰1"
    return { name: webtoon, day: day }; // 대리인 1이 가진 'day' 정보를 빌려옴!
  });
});

// 결과: [ [{name:"웹툰1", day:"A요일"}, {name:"웹툰2", day:"A요일"}], [{name:"웹툰3", day:"B요일"}] ]