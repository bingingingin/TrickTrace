#include <api/dll.h>
#include <api/solve_board.hpp>
#include <solver_context/solver_context.hpp>
#include <sstream>
#include <string>
#include <iostream>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
static SolverContext& context(){static SolverContext ctx(SolverConfig{TTKind::Large,16,64});return ctx;}
static std::string output;
extern "C" EMSCRIPTEN_KEEPALIVE const char* tt_solve(const char* input){
 std::istringstream in(input);Deal d{};in>>d.trump>>d.first;
 for(int i=0;i<3;i++)in>>d.currentTrickSuit[i]>>d.currentTrickRank[i];
 for(int h=0;h<4;h++)for(int s=0;s<4;s++)in>>d.remainCards[h][s];
 int target=-1;in>>target;
 FutureTricks f{};int code=SolveBoard(context(),d,target,target<0?3:2,1,&f);
 std::ostringstream o;o<<"{\"code\":"<<code<<",\"nodes\":"<<f.nodes<<",\"cards\":[";
 if(code==1)for(int i=0;i<f.cards;i++){if(i)o<<',';o<<'['<<f.suit[i]<<','<<f.rank[i]<<','<<f.equals[i]<<','<<f.score[i]<<']';}
 o<<"]}";output=o.str();return output.c_str();
}
extern "C" EMSCRIPTEN_KEEPALIVE const char* tt_par(const char* input){
 std::istringstream in(input);int dealer,vul;in>>dealer>>vul;DdTableResults t{};
 for(int s=0;s<5;s++)for(int h=0;h<4;h++)in>>t.res_table[s][h];
 ParResultsDealer p{};int code=DealerPar(&t,&p,dealer,vul);
 std::ostringstream o;o<<"{\"code\":"<<code<<",\"score\":"<<p.score<<",\"contracts\":[";
 if(code==1)for(int i=0;i<p.number;i++){if(i)o<<',';o<<'"'<<p.contracts[i]<<'"';}
 o<<"]}";output=o.str();return output.c_str();
}
#ifndef __EMSCRIPTEN__
int main(){std::string line;while(std::getline(std::cin,line))std::cout<<tt_solve(line.c_str())<<std::endl;}
#endif
