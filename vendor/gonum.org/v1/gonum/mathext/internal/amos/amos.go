// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package amos

import (
	"math"
	"math/cmplx"
)

/*
The AMOS functions are included in SLATEC, and the SLATEC guide (http://www.netlib.org/slatec/guide) explicitly states:
"The Library is in the public domain and distributed by the Energy
Science and Technology Software Center."
Mention of AMOS's inclusion in SLATEC goes back at least to this 1985 technical report from Sandia National Labs: http://infoserve.sandia.gov/sand_doc/1985/851018.pdf
*/

// math.NaN() are for padding to keep indexing easy.
var imach = []int{-0, 5, 6, 0, 0, 32, 4, 2, 31, 2147483647, 2, 24, -125, 127, 53, -1021, 1023}

var dmach = []float64{math.NaN(), 2.23e-308, 1.79e-308, 1.11e-16, 2.22e-16, 0.30103000998497009}

func abs(a int) int {
	if a >= 0 {
		return a
	}
	return -a
}

func Zairy(ZR, ZI float64, ID, KODE int) (AIR, AII float64, NZ, IERR int) {
	// zairy is adapted from the original Netlib code by Donald Amos.
	// http://www.netlib.no/netlib/amos/zairy.f

	// Original comment:
	/*
		C***BEGIN PROLOGUE  ZAIRY
		C***DATE WRITTEN   830501   (YYMMDD)
		C***REVISION DATE  890801   (YYMMDD)
		C***CATEGORY NO.  B5K
		C***KEYWORDS  AIRY FUNCTION,BESSEL FUNCTIONS OF ORDER ONE THIRD
		C***AUTHOR  AMOS, DONALD E., SANDIA NATIONAL LABORATORIES
		C***PURPOSE  TO COMPUTE AIRY FUNCTIONS AI(Z) AND DAI(Z) FOR COMPLEX Z
		C***DESCRIPTION
		C
		C                      ***A DOUBLE PRECISION ROUTINE***
		C         ON KODE=1, ZAIRY COMPUTES THE COMPLEX AIRY FUNCTION AI(Z) OR
		C         ITS DERIVATIVE DAI(Z)/DZ ON ID=0 OR ID=1 RESPECTIVELY. ON
		C         KODE=2, A SCALING OPTION CEXP(ZTA)*AI(Z) OR CEXP(ZTA)*
		C         DAI(Z)/DZ IS PROVIDED TO REMOVE THE EXPONENTIAL DECAY IN
		C         -PI/3<ARG(Z)<PI/3 AND THE EXPONENTIAL GROWTH IN
		C         PI/3<ABS(ARG(Z))<PI WHERE ZTA=(2/3)*Z*CSQRT(Z).
		C
		C         WHILE THE AIRY FUNCTIONS AI(Z) AND DAI(Z)/DZ ARE ANALYTIC IN
		C         THE WHOLE Z PLANE, THE CORRESPONDING SCALED FUNCTIONS DEFINED
		C         FOR KODE=2 HAVE A CUT ALONG THE NEGATIVE REAL AXIS.
		C         DEFINTIONS AND NOTATION ARE FOUND IN THE NBS HANDBOOK OF
		C         MATHEMATICAL FUNCTIONS (REF. 1).
		C
		C         INPUT      ZR,ZI ARE DOUBLE PRECISION
		C           ZR,ZI  - Z=CMPLX(ZR,ZI)
		C           ID     - ORDER OF DERIVATIVE, ID=0 OR ID=1
		C           KODE   - A PARAMETER TO INDICATE THE SCALING OPTION
		C                    KODE= 1  returnS
		C                             AI=AI(Z)                ON ID=0 OR
		C                             AI=DAI(Z)/DZ            ON ID=1
		C                        = 2  returnS
		C                             AI=CEXP(ZTA)*AI(Z)       ON ID=0 OR
		C                             AI=CEXP(ZTA)*DAI(Z)/DZ   ON ID=1 WHERE
		C                             ZTA=(2/3)*Z*CSQRT(Z)
		C
		C         OUTPUT     AIR,AII ARE DOUBLE PRECISION
		C           AIR,AII- COMPLEX ANSWER DEPENDING ON THE CHOICES FOR ID AND
		C                    KODE
		C           NZ     - UNDERFLOW INDICATOR
		C                    NZ= 0   , NORMAL return
		C                    NZ= 1   , AI=CMPLX(0.0E0,0.0E0) DUE TO UNDERFLOW IN
		C                              -PI/3<ARG(Z)<PI/3 ON KODE=1
		C           IERR   - ERROR FLAG
		C                    IERR=0, NORMAL return - COMPUTATION COMPLETED
		C                    IERR=1, INPUT ERROR   - NO COMPUTATION
		C                    IERR=2, OVERFLOW      - NO COMPUTATION, REAL(ZTA)
		C                            TOO LARGE ON KODE=1
		C                    IERR=3, CABS(Z) LARGE      - COMPUTATION COMPLETED
		C                            LOSSES OF SIGNIFCANCE BY ARGUMENT REDUCTION
		C                            PRODUCE LESS THAN HALF OF MACHINE ACCURACY
		C                    IERR=4, CABS(Z) TOO LARGE  - NO COMPUTATION
		C                            COMPLETE LOSS OF ACCURACY BY ARGUMENT
		C                            REDUCTION
		C                    IERR=5, ERROR              - NO COMPUTATION,
		C                            ALGORITHM TERMINATION CONDITION NOT MET
		C
		C***LONG DESCRIPTION
		C
		C         AI AND DAI ARE COMPUTED FOR CABS(Z)>1.0 FROM THE K BESSEL
		C         FUNCTIONS BY
		C
		C            AI(Z)=C*SQRT(Z)*K(1/3,ZTA) , DAI(Z)=-C*Z*K(2/3,ZTA)
		C                           C=1.0/(PI*SQRT(3.0))
		C                            ZTA=(2/3)*Z**(3/2)
		C
		C         WITH THE POWER SERIES FOR CABS(Z)<=1.0.
		C
		C         IN MOST COMPLEX VARIABLE COMPUTATION, ONE MUST EVALUATE ELE-
		C         MENTARY FUNCTIONS. WHEN THE MAGNITUDE OF Z IS LARGE, LOSSES
		C         OF SIGNIFICANCE BY ARGUMENT REDUCTION OCCUR. CONSEQUENTLY, IF
		C         THE MAGNITUDE OF ZETA=(2/3)*Z**1.5 EXCEEDS U1=SQRT(0.5/UR),
		C         THEN LOSSES EXCEEDING HALF PRECISION ARE LIKELY AND AN ERROR
		C         FLAG IERR=3 IS TRIGGERED WHERE UR=math.Max(dmach[4),1.0D-18) IS
		C         DOUBLE PRECISION UNIT ROUNDOFF LIMITED TO 18 DIGITS PRECISION.
		C         ALSO, if THE MAGNITUDE OF ZETA IS LARGER THAN U2=0.5/UR, THEN
		C         ALL SIGNIFICANCE IS LOST AND IERR=4. IN ORDER TO USE THE INT
		C         FUNCTION, ZETA MUST BE FURTHER RESTRICTED NOT TO EXCEED THE
		C         LARGEST INTEGER, U3=I1MACH(9). THUS, THE MAGNITUDE OF ZETA
		C         MUST BE RESTRICTED BY MIN(U2,U3). ON 32 BIT MACHINES, U1,U2,
		C         AND U3 ARE APPROXIMATELY 2.0E+3, 4.2E+6, 2.1E+9 IN SINGLE
		C         PRECISION ARITHMETIC AND 1.3E+8, 1.8E+16, 2.1E+9 IN DOUBLE
		C         PRECISION ARITHMETIC RESPECTIVELY. THIS MAKES U2 AND U3 LIMIT-
		C         ING IN THEIR RESPECTIVE ARITHMETICS. THIS MEANS THAT THE MAG-
		C         NITUDE OF Z CANNOT EXCEED 3.1E+4 IN SINGLE AND 2.1E+6 IN
		C         DOUBLE PRECISION ARITHMETIC. THIS ALSO MEANS THAT ONE CAN
		C         EXPECT TO RETAIN, IN THE WORST CASES ON 32 BIT MACHINES,
		C         NO DIGITS IN SINGLE PRECISION AND ONLY 7 DIGITS IN DOUBLE
		C         PRECISION ARITHMETIC. SIMILAR CONSIDERATIONS HOLD FOR OTHER
		C         MACHINES.
		C
		C         THE APPROXIMATE RELATIVE ERROR IN THE MAGNITUDE OF A COMPLEX
		C         BESSEL FUNCTION CAN BE EXPRESSED BY P*10**S WHERE P=MAX(UNIT
		C         ROUNDOFF,1.0E-18) IS THE NOMINAL PRECISION AND 10**S REPRE-
		C         SENTS THE INCREASE IN ERROR DUE TO ARGUMENT REDUCTION IN THE
		C         ELEMENTARY FUNCTIONS. HERE, S=MAX(1,ABS(LOG10(CABS(Z))),
		C         ABS(LOG10(FNU))) APPROXIMATELY (I.E. S=MAX(1,ABS(EXPONENT OF
		C         CABS(Z),ABS(EXPONENT OF FNU)) ). HOWEVER, THE PHASE ANGLE MAY
		C         HAVE ONLY ABSOLUTE ACCURACY. THIS IS MOST LIKELY TO OCCUR WHEN
		C         ONE COMPONENT (IN ABSOLUTE VALUE) IS LARGER THAN THE OTHER BY
		C         SEVERAL ORDERS OF MAGNITUDE. if ONE COMPONENT IS 10**K LARGER
		C         THAN THE OTHER, THEN ONE CAN EXPECT ONLY MAX(ABS(LOG10(P))-K,
		C         0) SIGNIFICANT DIGITS; OR, STATED ANOTHER WAY, WHEN K EXCEEDS
		C         THE EXPONENT OF P, NO SIGNIFICANT DIGITS REMAIN IN THE SMALLER
		C         COMPONENT. HOWEVER, THE PHASE ANGLE RETAINS ABSOLUTE ACCURACY
		C         BECAUSE, IN COMPLEX ARITHMETIC WITH PRECISION P, THE SMALLER
		C         COMPONENT WILL NOT (AS A RULE) DECREASE BELOW P TIMES THE
		C         MAGNITUDE OF THE LARGER COMPONENT. IN THESE EXTREME CASES,
		C         THE PRINCIPAL PHASE ANGLE IS ON THE ORDER OF +P, -P, PI/2-P,
		C         OR -PI/2+P.
		C
		C***REFERENCES  HANDBOOK OF MATHEMATICAL FUNCTIONS BY M. ABRAMOWITZ
		C                 AND I. A. STEGUN, NBS AMS SERIES 55, U.S. DEPT. OF
		C                 COMMERCE, 1955.
		C
		C               COMPUTATION OF BESSEL FUNCTIONS OF COMPLEX ARGUMENT
		C                 AND LARGE ORDER BY D. E. AMOS, SAND83-0643, MAY, 1983
		C
		C               A SUBROUTINE PACKAGE FOR BESSEL FUNCTIONS OF A COMPLEX
		C                 ARGUMENT AND NONNEGATIVE ORDER BY D. E. AMOS, SAND85-
		C                 1018, MAY, 1985
		C
		C               A PORTABLE PACKAGE FOR BESSEL FUNCTIONS OF A COMPLEX
		C                 ARGUMENT AND NONNEGATIVE ORDER BY D. E. AMOS, TRANS.
		C                 MATH. SOFTWARE, 1986
	*/
	var AI, CONE, CSQ, CY, S1, S2, TRM1, TRM2, Z, ZTA, Z3 complex128
	var AA, AD, AK, ALIM, ATRM, AZ, AZ3, BK,
		CC, CK, COEF, CONEI, CONER, CSQI, CSQR, C1, C2, DIG,
		DK, D1, D2, ELIM, FID, FNU, PTR, RL, R1M5, SFAC, STI, STR,
		S1I, S1R, S2I, S2R, TOL, TRM1I, TRM1R, TRM2I, TRM2R, TTH, ZEROI,
		ZEROR, ZTAI, ZTAR, Z3I, Z3R, ALAZ, BB float64
	var IFLAG, K, K1, K2, MR, NN int
	var tmp complex128

	// Extra element for padding.
	CYR := []float64{math.NaN(), 0}
	CYI := []float64{math.NaN(), 0}

	_ = AI
	_ = CONE
	_ = CSQ
	_ = CY
	_ = S1
	_ = S2
	_ = TRM1
	_ = TRM2
	_ = Z
	_ = ZTA
	_ = Z3

	TTH = 6.66666666666666667e-01
	C1 = 3.55028053887817240e-01
	C2 = 2.58819403792806799e-01
	COEF = 1.83776298473930683e-01
	ZEROR = 0
	ZEROI = 0
	CONER = 1
	CONEI = 0

	NZ = 0
	if ID < 0 || ID > 1 {
		IERR = 1
	}
	if KODE < 1 || KODE > 2 {
		IERR = 1
	}
	if IERR != 0 {
		return
	}
	AZ = cmplx.Abs(complex(ZR, ZI))
	TOL = math.Max(dmach[4], 1.0e-18)
	FID = float64(ID)
	if AZ > 1.0e0 {
		goto Seventy
	}

	// POWER SERIES FOR CABS(Z)<=1.
	S1R = CONER
	S1I = CONEI
	S2R = CONER
	S2I = CONEI
	if AZ < TOL {
		goto OneSeventy
	}
	AA = AZ * AZ
	if AA < TOL/AZ {
		goto Forty
	}
	TRM1R = CONER
	TRM1I = CONEI
	TRM2R = CONER
	TRM2I = CONEI
	ATRM = 1.0e0
	STR = ZR*ZR - ZI*ZI
	STI = ZR*ZI + ZI*ZR
	Z3R = STR*ZR - STI*ZI
	Z3I = STR*ZI + STI*ZR
	AZ3 = AZ * AA
	AK = 2.0e0 + FID
	BK = 3.0e0 - FID - FID
	CK = 4.0e0 - FID
	DK = 3.0e0 + FID + FID
	D1 = AK * DK
	D2 = BK * CK
	AD = math.Min(D1, D2)
	AK = 24.0e0 + 9.0e0*FID
	BK = 30.0e0 - 9.0e0*FID
	for K = 1; K <= 25; K++ {
		STR = (TRM1R*Z3R - TRM1I*Z3I) / D1
		TRM1I = (TRM1R*Z3I + TRM1I*Z3R) / D1
		TRM1R = STR
		S1R = S1R + TRM1R
		S1I = S1I + TRM1I
		STR = (TRM2R*Z3R - TRM2I*Z3I) / D2
		TRM2I = (TRM2R*Z3I + TRM2I*Z3R) / D2
		TRM2R = STR
		S2R = S2R + TRM2R
		S2I = S2I + TRM2I
		ATRM = ATRM * AZ3 / AD
		D1 = D1 + AK
		D2 = D2 + BK
		AD = math.Min(D1, D2)
		if ATRM < TOL*AD {
			goto Forty
		}
		AK = AK + 18.0e0
		BK = BK + 18.0e0
	}
Forty:
	if ID == 1 {
		goto Fifty
	}
	AIR = S1R*C1 - C2*(ZR*S2R-ZI*S2I)
	AII = S1I*C1 - C2*(ZR*S2I+ZI*S2R)
	if KODE == 1 {
		return
	}
	tmp = cmplx.Sqrt(complex(ZR, ZI))
	STR = real(tmp)
	STI = imag(tmp)
	ZTAR = TTH * (ZR*STR - ZI*STI)
	ZTAI = TTH * (ZR*STI + ZI*STR)
	tmp = cmplx.Exp(complex(ZTAR, ZTAI))
	STR = real(tmp)
	STI = imag(tmp)
	PTR = AIR*STR - AII*STI
	AII = AIR*STI + AII*STR
	AIR = PTR
	return

Fifty:
	AIR = -S2R * C2
	AII = -S2I * C2
	if AZ <= TOL {
		goto Sixty
	}
	STR = ZR*S1R - ZI*S1I
	STI = ZR*S1I + ZI*S1R
	CC = C1 / (1.0e0 + FID)
	AIR = AIR + CC*(STR*ZR-STI*ZI)
	AII = AII + CC*(STR*ZI+STI*ZR)

Sixty:
	if KODE == 1 {
		return
	}
	tmp = cmplx.Sqrt(complex(ZR, ZI))
	STR = real(tmp)
	STI = imag(tmp)
	ZTAR = TTH * (ZR*STR - ZI*STI)
	ZTAI = TTH * (ZR*STI + ZI*STR)
	tmp = cmplx.Exp(complex(ZTAR, ZTAI))
	STR = real(tmp)
	STI = imag(tmp)
	PTR = STR*AIR - STI*AII
	AII = STR*AII + STI*AIR
	AIR = PTR
	return

	// CASE FOR CABS(Z)>1.0.
Seventy:
	FNU = (1.0e0 + FID) / 3.0e0

	/*
	   SET PARAMETERS RELATED TO MACHINE CONSTANTS.
	   TOL IS THE APPROXIMATE UNIT ROUNDOFF LIMITED TO 1.0D-18.
	   ELIM IS THE APPROXIMATE EXPONENTIAL OVER-&&UNDERFLOW LIMIT.
	   EXP(-ELIM)<EXP(-ALIM)=EXP(-ELIM)/TOL    AND
	   EXP(ELIM)>EXP(ALIM)=EXP(ELIM)*TOL       ARE INTERVALS NEAR
	   UNDERFLOW&&OVERFLOW LIMITS WHERE SCALED ARITHMETIC IS DONE.
	   RL IS THE LOWER BOUNDARY OF THE ASYMPTOTIC EXPANSION FOR LA>=Z.
	   DIG = NUMBER OF BASE 10 DIGITS IN TOL = 10**(-DIG).
	*/
	K1 = imach[15]
	K2 = imach[16]
	R1M5 = dmach[5]

	K = min(abs(K1), abs(K2))
	ELIM = 2.303e0 * (float64(K)*R1M5 - 3.0e0)
	K1 = imach[14] - 1
	AA = R1M5 * float64(K1)
	DIG = math.Min(AA, 18.0e0)
	AA = AA * 2.303e0
	ALIM = ELIM + math.Max(-AA, -41.45e0)
	RL = 1.2e0*DIG + 3.0e0
	ALAZ = math.Log(AZ)

	// TEST FOR PROPER RANGE.
	AA = 0.5e0 / TOL
	BB = float64(float32(imach[9])) * 0.5e0
	AA = math.Min(AA, BB)
	AA = math.Pow(AA, TTH)
	if AZ > AA {
		goto TwoSixty
	}
	AA = math.Sqrt(AA)
	if AZ > AA {
		IERR = 3
	}
	tmp = cmplx.Sqrt(complex(ZR, ZI))
	CSQR = real(tmp)
	CSQI = imag(tmp)
	ZTAR = TTH * (ZR*CSQR - ZI*CSQI)
	ZTAI = TTH * (ZR*CSQI + ZI*CSQR)

	//  RE(ZTA)<=0 WHEN RE(Z)<0, ESPECIALLY WHEN IM(Z) IS SMALL.
	IFLAG = 0
	SFAC = 1.0e0
	AK = ZTAI
	if ZR >= 0.0e0 {
		goto Eighty
	}
	BK = ZTAR
	CK = -math.Abs(BK)
	ZTAR = CK
	ZTAI = AK

Eighty:
	if ZI != 0.0e0 {
		goto Ninety
	}
	if ZR > 0.0e0 {
		goto Ninety
	}
	ZTAR = 0.0e0
	ZTAI = AK
Ninety:
	AA = ZTAR
	if AA >= 0.0e0 && ZR > 0.0e0 {
		goto OneTen
	}
	if KODE == 2 {
		goto OneHundred
	}

	// OVERFLOW TEST.
	if AA > (-ALIM) {
		goto OneHundred
	}
	AA = -AA + 0.25e0*ALAZ
	IFLAG = 1
	SFAC = TOL
	if AA > ELIM {
		goto TwoSeventy
	}

OneHundred:
	// CBKNU AND CACON return EXP(ZTA)*K(FNU,ZTA) ON KODE=2.
	MR = 1
	if ZI < 0.0e0 {
		MR = -1
	}
	_, _, _, _, _, _, CYR, CYI, NN, _, _, _, _ = Zacai(ZTAR, ZTAI, FNU, KODE, MR, 1, CYR, CYI, RL, TOL, ELIM, ALIM)
	if NN < 0 {
		goto TwoEighty
	}
	NZ = NZ + NN
	goto OneThirty

OneTen:
	if KODE == 2 {
		goto OneTwenty
	}

	// UNDERFLOW TEST.
	if AA < ALIM {
		goto OneTwenty
	}
	AA = -AA - 0.25e0*ALAZ
	IFLAG = 2
	SFAC = 1.0e0 / TOL
	if AA < (-ELIM) {
		goto TwoTen
	}
OneTwenty:
	_, _, _, _, _, CYR, CYI, NZ, _, _, _ = Zbknu(ZTAR, ZTAI, FNU, KODE, 1, CYR, CYI, TOL, ELIM, ALIM)

OneThirty:
	S1R = CYR[1] * COEF
	S1I = CYI[1] * COEF
	if IFLAG != 0 {
		goto OneFifty
	}
	if ID == 1 {
		goto OneFourty
	}
	AIR = CSQR*S1R - CSQI*S1I
	AII = CSQR*S1I + CSQI*S1R
	return
OneFourty:
	AIR = -(ZR*S1R - ZI*S1I)
	AII = -(ZR*S1I + ZI*S1R)
	return
OneFifty:
	S1R = S1R * SFAC
	S1I = S1I * SFAC
	if ID == 1 {
		goto OneSixty
	}
	STR = S1R*CSQR - S1I*CSQI
	S1I = S1R*CSQI + S1I*CSQR
	S1R = STR
	AIR = S1R / SFAC
	AII = S1I / SFAC
	return
OneSixty:
	STR = -(S1R*ZR - S1I*ZI)
	S1I = -(S1R*ZI + S1I*ZR)
	S1R = STR
	AIR = S1R / SFAC
	AII = S1I / SFAC
	return
OneSeventy:
	AA = 1.0e+3 * dmach[1]
	S1R = ZEROR
	S1I = ZEROI
	if ID == 1 {
		goto OneNinety
	}
	if AZ <= AA {
		goto OneEighty
	}
	S1R = C2 * ZR
	S1I = C2 * ZI
OneEighty:
	AIR = C1 - S1R
	AII = -S1I
	return
OneNinety:
	AIR = -C2
	AII = 0.0e0
	AA = math.Sqrt(AA)
	if AZ <= AA {
		goto TwoHundred
	}
	S1R = 0.5e0 * (ZR*ZR - ZI*ZI)
	S1I = ZR * ZI
TwoHundred:
	AIR = AIR + C1*S1R
	AII = AII + C1*S1I
	return
TwoTen:
	NZ = 1
	AIR = ZEROR
	AII = ZEROI
	return
TwoSeventy:
	NZ = 0
	IERR = 2
	return
TwoEighty:
	if NN == (-1) {
		goto TwoSeventy
	}
	NZ = 0
	IERR = 5
	return
TwoSixty:
	IERR = 4
	NZ = 0
	return
}

// sbknu computes the k bessel function in the right half z plane.
func Zbknu(ZR, ZI, FNU float64, KODE, N int, YR, YI []float64, TOL, ELIM, ALIM float64) (ZRout, ZIout, FNUout float64, KODEout, Nout int, YRout, YIout []float64, NZ int, TOLout, ELIMout, ALIMout float64) {
	/* Old dimension comment.
		DIMENSION YR(N), YI(N), CC(8), CSSR(3), CSRR(3), BRY(3), CYR(2),
	     * CYI(2)
	*/

	// TODO(btracey): Find which of these are inputs/outputs/both and clean up
	// the function call.
	// YR and YI have length n (but n+1 with better indexing)
	var AA, AK, ASCLE, A1, A2, BB, BK, CAZ,
		CBI, CBR, CCHI, CCHR, CKI, CKR, COEFI, COEFR, CONEI, CONER,
		CRSCR, CSCLR, CSHI, CSHR, CSI, CSR, CTWOR,
		CZEROI, CZEROR, CZI, CZR, DNU, DNU2, DPI, ETEST, FC, FHS,
		FI, FK, FKS, FMUI, FMUR, FPI, FR, G1, G2, HPI, PI, PR, PTI,
		PTR, P1I, P1R, P2I, P2M, P2R, QI, QR, RAK, RCAZ, RTHPI, RZI,
		RZR, R1, S, SMUI, SMUR, SPI, STI, STR, S1I, S1R, S2I, S2R, TM,
		TTH, T1, T2, ELM, CELMR, ZDR, ZDI, AS, ALAS, HELIM float64

	var I, IFLAG, INU, K, KFLAG, KK, KMAX, KODED, IDUM, J, IC, INUB, NW int

	var sinh, cosh complex128
	//var sin, cos float64

	var tmp, p complex128
	var CSSR, CSRR, BRY [4]float64
	var CYR, CYI [3]float64

	KMAX = 30
	CZEROR = 0
	CZEROI = 0
	CONER = 1
	CONEI = 0
	CTWOR = 2
	R1 = 2

	DPI = 3.14159265358979324e0
	RTHPI = 1.25331413731550025e0
	SPI = 1.90985931710274403e0
	HPI = 1.57079632679489662e0
	FPI = 1.89769999331517738e0
	TTH = 6.66666666666666666e-01

	CC := [9]float64{math.NaN(), 5.77215664901532861e-01, -4.20026350340952355e-02,
		-4.21977345555443367e-02, 7.21894324666309954e-03,
		-2.15241674114950973e-04, -2.01348547807882387e-05,
		1.13302723198169588e-06, 6.11609510448141582e-09}

	CAZ = cmplx.Abs(complex(ZR, ZI))
	CSCLR = 1.0e0 / TOL
	CRSCR = TOL
	CSSR[1] = CSCLR
	CSSR[2] = 1.0e0
	CSSR[3] = CRSCR
	CSRR[1] = CRSCR
	CSRR[2] = 1.0e0
	CSRR[3] = CSCLR
	BRY[1] = 1.0e+3 * dmach[1] / TOL
	BRY[2] = 1.0e0 / BRY[1]
	BRY[3] = dmach[2]
	IFLAG = 0
	KODED = KODE
	RCAZ = 1.0e0 / CAZ
	STR = ZR * RCAZ
	STI = -ZI * RCAZ
	RZR = (STR + STR) * RCAZ
	RZI = (STI + STI) * RCAZ
	INU = int(float32(FNU + 0.5))
	DNU = FNU - float64(INU)
	if math.Abs(DNU) == 0.5e0 {
		goto OneTen
	}
	DNU2 = 0.0e0
	if math.Abs(DNU) > TOL {
		DNU2 = DNU * DNU
	}
	if CAZ > R1 {
		goto OneTen
	}

	// SERIES FOR CABS(Z)<=R1.
	FC = 1.0e0
	tmp = cmplx.Log(complex(RZR, RZI))
	SMUR = real(tmp)
	SMUI = imag(tmp)
	FMUR = SMUR * DNU
	FMUI = SMUI * DNU
	tmp = complex(FMUR, FMUI)
	sinh = cmplx.Sinh(tmp)
	cosh = cmplx.Cosh(tmp)
	CSHR = real(sinh)
	CSHI = imag(sinh)
	CCHR = real(cosh)
	CCHI = imag(cosh)
	if DNU == 0.0e0 {
		goto Ten
	}
	FC = DNU * DPI
	FC = FC / math.Sin(FC)
	SMUR = CSHR / DNU
	SMUI = CSHI / DNU
Ten:
	A2 = 1.0e0 + DNU

	// GAM(1-Z)*GAM(1+Z)=PI*Z/SIN(PI*Z), T1=1/GAM(1-DNU), T2=1/GAM(1+DNU).
	T2 = math.Exp(-dgamln(A2, IDUM))
	T1 = 1.0e0 / (T2 * FC)
	if math.Abs(DNU) > 0.1e0 {
		goto Forty
	}

	// SERIES FOR F0 TO RESOLVE INDETERMINACY FOR SMALL ABS(DNU).
	AK = 1.0e0
	S = CC[1]
	for K = 2; K <= 8; K++ {
		AK = AK * DNU2
		TM = CC[K] * AK
		S = S + TM
		if math.Abs(TM) < TOL {
			goto Thirty
		}
	}
Thirty:
	G1 = -S
	goto Fifty
Forty:
	G1 = (T1 - T2) / (DNU + DNU)
Fifty:
	G2 = (T1 + T2) * 0.5e0
	FR = FC * (CCHR*G1 + SMUR*G2)
	FI = FC * (CCHI*G1 + SMUI*G2)
	tmp = cmplx.Exp(complex(FMUR, FMUI))
	STR = real(tmp)
	STI = imag(tmp)
	PR = 0.5e0 * STR / T2
	PI = 0.5e0 * STI / T2
	tmp = complex(0.5, 0) / complex(STR, STI)
	PTR = real(tmp)
	PTI = imag(tmp)
	QR = PTR / T1
	QI = PTI / T1
	S1R = FR
	S1I = FI
	S2R = PR
	S2I = PI
	AK = 1.0e0
	A1 = 1.0e0
	CKR = CONER
	CKI = CONEI
	BK = 1.0e0 - DNU2
	if INU > 0 || N > 1 {
		goto Eighty
	}

	// GENERATE K(FNU,Z), 0.0E0 <= FNU < 0.5E0 AND N=1.
	if CAZ < TOL {
		goto Seventy
	}
	tmp = complex(ZR, ZI) * complex(ZR, ZI)
	CZR = real(tmp)
	CZI = imag(tmp)
	CZR = 0.25e0 * CZR
	CZI = 0.25e0 * CZI
	T1 = 0.25e0 * CAZ * CAZ
Sixty:
	FR = (FR*AK + PR + QR) / BK
	FI = (FI*AK + PI + QI) / BK
	STR = 1.0e0 / (AK - DNU)
	PR = PR * STR
	PI = PI * STR
	STR = 1.0e0 / (AK + DNU)
	QR = QR * STR
	QI = QI * STR
	STR = CKR*CZR - CKI*CZI
	RAK = 1.0e0 / AK
	CKI = (CKR*CZI + CKI*CZR) * RAK
	CKR = STR * RAK
	S1R = CKR*FR - CKI*FI + S1R
	S1I = CKR*FI + CKI*FR + S1I
	A1 = A1 * T1 * RAK
	BK = BK + AK + AK + 1.0e0
	AK = AK + 1.0e0
	if A1 > TOL {
		goto Sixty
	}
Seventy:
	YR[1] = S1R
	YI[1] = S1I
	if KODED == 1 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	tmp = cmplx.Exp(complex(ZR, ZI))
	STR = real(tmp)
	STI = imag(tmp)
	tmp = complex(S1R, S1I) * complex(STR, STI)
	YR[1] = real(tmp)
	YI[1] = imag(tmp)
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM

	// GENERATE K(DNU,Z) AND K(DNU+1,Z) FOR FORWARD RECURRENCE.
Eighty:
	if CAZ < TOL {
		goto OneHundred
	}
	tmp = complex(ZR, ZI) * complex(ZR, ZI)
	CZR = real(tmp)
	CZI = imag(tmp)
	CZR = 0.25e0 * CZR
	CZI = 0.25e0 * CZI
	T1 = 0.25e0 * CAZ * CAZ
Ninety:
	FR = (FR*AK + PR + QR) / BK
	FI = (FI*AK + PI + QI) / BK
	STR = 1.0e0 / (AK - DNU)
	PR = PR * STR
	PI = PI * STR
	STR = 1.0e0 / (AK + DNU)
	QR = QR * STR
	QI = QI * STR
	STR = CKR*CZR - CKI*CZI
	RAK = 1.0e0 / AK
	CKI = (CKR*CZI + CKI*CZR) * RAK
	CKR = STR * RAK
	S1R = CKR*FR - CKI*FI + S1R
	S1I = CKR*FI + CKI*FR + S1I
	STR = PR - FR*AK
	STI = PI - FI*AK
	S2R = CKR*STR - CKI*STI + S2R
	S2I = CKR*STI + CKI*STR + S2I
	A1 = A1 * T1 * RAK
	BK = BK + AK + AK + 1.0e0
	AK = AK + 1.0e0
	if A1 > TOL {
		goto Ninety
	}
OneHundred:
	KFLAG = 2
	A1 = FNU + 1.0e0
	AK = A1 * math.Abs(SMUR)
	if AK > ALIM {
		KFLAG = 3
	}
	STR = CSSR[KFLAG]
	P2R = S2R * STR
	P2I = S2I * STR
	tmp = complex(P2R, P2I) * complex(RZR, RZI)
	S2R = real(tmp)
	S2I = imag(tmp)
	S1R = S1R * STR
	S1I = S1I * STR
	if KODED == 1 {
		goto TwoTen
	}
	tmp = cmplx.Exp(complex(ZR, ZI))
	FR = real(tmp)
	FI = imag(tmp)
	tmp = complex(S1R, S1I) * complex(FR, FI)
	S1R = real(tmp)
	S1I = imag(tmp)
	tmp = complex(S2R, S2I) * complex(FR, FI)
	S2R = real(tmp)
	S2I = imag(tmp)
	goto TwoTen

	// IFLAG=0 MEANS NO UNDERFLOW OCCURRED
	// IFLAG=1 MEANS AN UNDERFLOW OCCURRED- COMPUTATION PROCEEDS WITH
	// KODED=2 AND A TEST FOR ON SCALE VALUES IS MADE DURING FORWARD RECURSION
OneTen:
	tmp = cmplx.Sqrt(complex(ZR, ZI))
	STR = real(tmp)
	STI = imag(tmp)
	tmp = complex(RTHPI, CZEROI) / complex(STR, STI)
	COEFR = real(tmp)
	COEFI = imag(tmp)
	KFLAG = 2
	if KODED == 2 {
		goto OneTwenty
	}
	if ZR > ALIM {
		goto TwoNinety
	}

	STR = math.Exp(-ZR) * CSSR[KFLAG]
	//sin, cos = math.Sincos(ZI)
	STI = -STR * math.Sin(ZI)
	STR = STR * math.Cos(ZI)
	tmp = complex(COEFR, COEFI) * complex(STR, STI)
	COEFR = real(tmp)
	COEFI = imag(tmp)
OneTwenty:
	if math.Abs(DNU) == 0.5e0 {
		goto ThreeHundred
	}
	// MILLER ALGORITHM FOR CABS(Z)>R1.
	AK = math.Cos(DPI * DNU)
	AK = math.Abs(AK)
	if AK == CZEROR {
		goto ThreeHundred
	}
	FHS = math.Abs(0.25e0 - DNU2)
	if FHS == CZEROR {
		goto ThreeHundred
	}

	// COMPUTE R2=F(E). if CABS(Z)>=R2, USE FORWARD RECURRENCE TO
	// DETERMINE THE BACKWARD INDEX K. R2=F(E) IS A STRAIGHT LINE ON
	// 12<=E<=60. E IS COMPUTED FROM 2**(-E)=B**(1-I1MACH(14))=
	// TOL WHERE B IS THE BASE OF THE ARITHMETIC.
	T1 = float64(imach[14] - 1)
	T1 = T1 * dmach[5] * 3.321928094e0
	T1 = math.Max(T1, 12.0e0)
	T1 = math.Min(T1, 60.0e0)
	T2 = TTH*T1 - 6.0e0
	if ZR != 0.0e0 {
		goto OneThirty
	}
	T1 = HPI
	goto OneFourty
OneThirty:
	T1 = math.Atan(ZI / ZR)
	T1 = math.Abs(T1)
OneFourty:
	if T2 > CAZ {
		goto OneSeventy
	}
	// FORWARD RECURRENCE LOOP WHEN CABS(Z)>=R2.
	ETEST = AK / (DPI * CAZ * TOL)
	FK = CONER
	if ETEST < CONER {
		goto OneEighty
	}
	FKS = CTWOR
	CKR = CAZ + CAZ + CTWOR
	P1R = CZEROR
	P2R = CONER
	for I = 1; I <= KMAX; I++ {
		AK = FHS / FKS
		CBR = CKR / (FK + CONER)
		PTR = P2R
		P2R = CBR*P2R - P1R*AK
		P1R = PTR
		CKR = CKR + CTWOR
		FKS = FKS + FK + FK + CTWOR
		FHS = FHS + FK + FK
		FK = FK + CONER
		STR = math.Abs(P2R) * FK
		if ETEST < STR {
			goto OneSixty
		}
	}
	goto ThreeTen
OneSixty:
	FK = FK + SPI*T1*math.Sqrt(T2/CAZ)
	FHS = math.Abs(0.25 - DNU2)
	goto OneEighty
OneSeventy:
	// COMPUTE BACKWARD INDEX K FOR CABS(Z)<R2.
	A2 = math.Sqrt(CAZ)
	AK = FPI * AK / (TOL * math.Sqrt(A2))
	AA = 3.0e0 * T1 / (1.0e0 + CAZ)
	BB = 14.7e0 * T1 / (28.0e0 + CAZ)
	AK = (math.Log(AK) + CAZ*math.Cos(AA)/(1.0e0+0.008e0*CAZ)) / math.Cos(BB)
	FK = 0.12125e0*AK*AK/CAZ + 1.5e0
OneEighty:
	// BACKWARD RECURRENCE LOOP FOR MILLER ALGORITHM.
	K = int(float32(FK))
	FK = float64(K)
	FKS = FK * FK
	P1R = CZEROR
	P1I = CZEROI
	P2R = TOL
	P2I = CZEROI
	CSR = P2R
	CSI = P2I
	for I = 1; I <= K; I++ {
		A1 = FKS - FK
		AK = (FKS + FK) / (A1 + FHS)
		RAK = 2.0e0 / (FK + CONER)
		CBR = (FK + ZR) * RAK
		CBI = ZI * RAK
		PTR = P2R
		PTI = P2I
		P2R = (PTR*CBR - PTI*CBI - P1R) * AK
		P2I = (PTI*CBR + PTR*CBI - P1I) * AK
		P1R = PTR
		P1I = PTI
		CSR = CSR + P2R
		CSI = CSI + P2I
		FKS = A1 - FK + CONER
		FK = FK - CONER
	}
	// COMPUTE (P2/CS)=(P2/CABS(CS))*(CONJG(CS)/CABS(CS)) FOR BETTER SCALING.
	TM = cmplx.Abs(complex(CSR, CSI))
	PTR = 1.0e0 / TM
	S1R = P2R * PTR
	S1I = P2I * PTR
	CSR = CSR * PTR
	CSI = -CSI * PTR
	tmp = complex(COEFR, COEFI) * complex(S1R, S1I)
	STR = real(tmp)
	STI = imag(tmp)
	tmp = complex(STR, STI) * complex(CSR, CSI)
	S1R = real(tmp)
	S1I = imag(tmp)
	if INU > 0 || N > 1 {
		goto TwoHundred
	}
	ZDR = ZR
	ZDI = ZI
	if IFLAG == 1 {
		goto TwoSeventy
	}
	goto TwoFourty
TwoHundred:
	// COMPUTE P1/P2=(P1/CABS(P2)*CONJG(P2)/CABS(P2) FOR SCALING.
	TM = cmplx.Abs(complex(P2R, P2I))
	PTR = 1.0e0 / TM
	P1R = P1R * PTR
	P1I = P1I * PTR
	P2R = P2R * PTR
	P2I = -P2I * PTR
	tmp = complex(P1R, P1I) * complex(P2R, P2I)
	PTR = real(tmp)
	PTI = imag(tmp)
	STR = DNU + 0.5e0 - PTR
	STI = -PTI
	tmp = complex(STR, STI) / complex(ZR, ZI)
	STR = real(tmp)
	STI = imag(tmp)
	STR = STR + 1.0e0
	tmp = complex(STR, STI) * complex(S1R, S1I)
	S2R = real(tmp)
	S2I = imag(tmp)

	// FORWARD RECURSION ON THE THREE TERM RECURSION WITH RELATION WITH
	// SCALING NEAR EXPONENT EXTREMES ON KFLAG=1 OR KFLAG=3
TwoTen:
	STR = DNU + 1.0e0
	CKR = STR * RZR
	CKI = STR * RZI
	if N == 1 {
		INU = INU - 1
	}
	if INU > 0 {
		goto TwoTwenty
	}
	if N > 1 {
		goto TwoFifteen
	}
	S1R = S2R
	S1I = S2I
TwoFifteen:
	ZDR = ZR
	ZDI = ZI
	if IFLAG == 1 {
		goto TwoSeventy
	}
	goto TwoFourty
TwoTwenty:
	INUB = 1
	if IFLAG == 1 {
		goto TwoSixtyOne
	}
TwoTwentyFive:
	P1R = CSRR[KFLAG]
	ASCLE = BRY[KFLAG]
	for I = INUB; I <= INU; I++ {
		STR = S2R
		STI = S2I
		S2R = CKR*STR - CKI*STI + S1R
		S2I = CKR*STI + CKI*STR + S1I
		S1R = STR
		S1I = STI
		CKR = CKR + RZR
		CKI = CKI + RZI
		if KFLAG >= 3 {
			continue
		}
		P2R = S2R * P1R
		P2I = S2I * P1R
		STR = math.Abs(P2R)
		STI = math.Abs(P2I)
		P2M = math.Max(STR, STI)
		if P2M <= ASCLE {
			continue
		}
		KFLAG = KFLAG + 1
		ASCLE = BRY[KFLAG]
		S1R = S1R * P1R
		S1I = S1I * P1R
		S2R = P2R
		S2I = P2I
		STR = CSSR[KFLAG]
		S1R = S1R * STR
		S1I = S1I * STR
		S2R = S2R * STR
		S2I = S2I * STR
		P1R = CSRR[KFLAG]
	}
	if N != 1 {
		goto TwoFourty
	}
	S1R = S2R
	S1I = S2I
TwoFourty:
	STR = CSRR[KFLAG]
	YR[1] = S1R * STR
	YI[1] = S1I * STR
	if N == 1 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	YR[2] = S2R * STR
	YI[2] = S2I * STR
	if N == 2 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	KK = 2
TwoFifty:
	KK = KK + 1
	if KK > N {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	P1R = CSRR[KFLAG]
	ASCLE = BRY[KFLAG]
	for I = KK; I <= N; I++ {
		P2R = S2R
		P2I = S2I
		S2R = CKR*P2R - CKI*P2I + S1R
		S2I = CKI*P2R + CKR*P2I + S1I
		S1R = P2R
		S1I = P2I
		CKR = CKR + RZR
		CKI = CKI + RZI
		P2R = S2R * P1R
		P2I = S2I * P1R
		YR[I] = P2R
		YI[I] = P2I
		if KFLAG >= 3 {
			continue
		}
		STR = math.Abs(P2R)
		STI = math.Abs(P2I)
		P2M = math.Max(STR, STI)
		if P2M <= ASCLE {
			continue
		}
		KFLAG = KFLAG + 1
		ASCLE = BRY[KFLAG]
		S1R = S1R * P1R
		S1I = S1I * P1R
		S2R = P2R
		S2I = P2I
		STR = CSSR[KFLAG]
		S1R = S1R * STR
		S1I = S1I * STR
		S2R = S2R * STR
		S2I = S2I * STR
		P1R = CSRR[KFLAG]
	}
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM

	// IFLAG=1 CASES, FORWARD RECURRENCE ON SCALED VALUES ON UNDERFLOW.
TwoSixtyOne:
	HELIM = 0.5e0 * ELIM
	ELM = math.Exp(-ELIM)
	CELMR = ELM
	ASCLE = BRY[1]
	ZDR = ZR
	ZDI = ZI
	IC = -1
	J = 2
	for I = 1; I <= INU; I++ {
		STR = S2R
		STI = S2I
		S2R = STR*CKR - STI*CKI + S1R
		S2I = STI*CKR + STR*CKI + S1I
		S1R = STR
		S1I = STI
		CKR = CKR + RZR
		CKI = CKI + RZI
		AS = cmplx.Abs(complex(S2R, S2I))
		ALAS = math.Log(AS)
		P2R = -ZDR + ALAS
		if P2R < (-ELIM) {
			goto TwoSixtyThree
		}
		tmp = cmplx.Log(complex(S2R, S2I))
		STR = real(tmp)
		STI = imag(tmp)
		P2R = -ZDR + STR
		P2I = -ZDI + STI
		P2M = math.Exp(P2R) / TOL
		// sin, cos = math.Sincos(P2I)
		P1R = P2M * math.Cos(P2I)
		P1I = P2M * math.Sin(P2I)
		p = complex(P1R, P1I)
		NW = Zuchk(p, ASCLE, TOL)
		if NW != 0 {
			goto TwoSixtyThree
		}
		J = 3 - J
		CYR[J] = P1R
		CYI[J] = P1I
		if IC == (I - 1) {
			goto TwoSixtyFour
		}
		IC = I
		continue
	TwoSixtyThree:
		if ALAS < HELIM {
			continue
		}
		ZDR = ZDR - ELIM
		S1R = S1R * CELMR
		S1I = S1I * CELMR
		S2R = S2R * CELMR
		S2I = S2I * CELMR
	}
	if N != 1 {
		goto TwoSeventy
	}
	S1R = S2R
	S1I = S2I
	goto TwoSeventy
TwoSixtyFour:
	KFLAG = 1
	INUB = I + 1
	S2R = CYR[J]
	S2I = CYI[J]
	J = 3 - J
	S1R = CYR[J]
	S1I = CYI[J]
	if INUB <= INU {
		goto TwoTwentyFive
	}
	if N != 1 {
		goto TwoFourty
	}
	S1R = S2R
	S1I = S2I
	goto TwoFourty
TwoSeventy:
	YR[1] = S1R
	YI[1] = S1I
	if N == 1 {
		goto TwoEighty
	}
	YR[2] = S2R
	YI[2] = S2I
TwoEighty:
	ASCLE = BRY[1]
	_, _, FNU, N, YR, YI, NZ, RZR, RZI, _, TOL, ELIM = Zkscl(ZDR, ZDI, FNU, N, YR, YI, RZR, RZI, ASCLE, TOL, ELIM)
	INU = N - NZ
	if INU <= 0 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	KK = NZ + 1
	S1R = YR[KK]
	S1I = YI[KK]
	YR[KK] = S1R * CSRR[1]
	YI[KK] = S1I * CSRR[1]
	if INU == 1 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	KK = NZ + 2
	S2R = YR[KK]
	S2I = YI[KK]
	YR[KK] = S2R * CSRR[1]
	YI[KK] = S2I * CSRR[1]
	if INU == 2 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
	}
	T2 = FNU + float64(float32(KK-1))
	CKR = T2 * RZR
	CKI = T2 * RZI
	KFLAG = 1
	goto TwoFifty
TwoNinety:

	// SCALE BY math.Exp(Z), IFLAG = 1 CASES.

	IFLAG = 1
	KFLAG = 2
	goto OneTwenty

	// FNU=HALF ODD INTEGER CASE, DNU=-0.5
ThreeHundred:
	S1R = COEFR
	S1I = COEFI
	S2R = COEFR
	S2I = COEFI
	goto TwoTen

ThreeTen:
	NZ = -2
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL, ELIM, ALIM
}

// SET K FUNCTIONS TO ZERO ON UNDERFLOW, CONTINUE RECURRENCE
// ON SCALED FUNCTIONS UNTIL TWO MEMBERS COME ON SCALE, THEN
// return WITH MIN(NZ+2,N) VALUES SCALED BY 1/TOL.
func Zkscl(ZRR, ZRI, FNU float64, N int, YR, YI []float64, RZR, RZI, ASCLE, TOL, ELIM float64) (
	ZRRout, ZRIout, FNUout float64, Nout int, YRout, YIout []float64, NZ int, RZRout, RZIout, ASCLEout, TOLout, ELIMout float64) {
	var ACS, AS, CKI, CKR, CSI, CSR, FN, STR, S1I, S1R, S2I,
		S2R, ZEROI, ZEROR, ZDR, ZDI, CELMR, ELM, HELIM, ALAS float64

	var I, IC, KK, NN, NW int
	var tmp, c complex128
	var CYR, CYI [3]float64
	var sin, cos float64

	// DIMENSION YR(N), YI(N), CYR(2), CYI(2)
	ZEROR = 0
	ZEROI = 0
	IC = 0
	NN = min(2, N)
	for I = 1; I <= NN; I++ {
		S1R = YR[I]
		S1I = YI[I]
		CYR[I] = S1R
		CYI[I] = S1I
		AS = cmplx.Abs(complex(S1R, S1I))
		ACS = -ZRR + math.Log(AS)
		NZ = NZ + 1
		YR[I] = ZEROR
		YI[I] = ZEROI
		if ACS < (-ELIM) {
			continue
		}

		tmp = cmplx.Log(complex(S1R, S1I))
		CSR = real(tmp)
		CSI = imag(tmp)
		CSR = CSR - ZRR
		CSI = CSI - ZRI
		STR = math.Exp(CSR) / TOL
		// sin, cos = math.Sincos(CSI)
		CSR = STR * math.Cos(CSI)
		CSI = STR * math.Sin(CSI)
		c = complex(CSR, CSI)
		NW = Zuchk(c, ASCLE, TOL)
		if NW != 0 {
			continue
		}
		YR[I] = CSR
		YI[I] = CSI
		IC = I
		NZ = NZ - 1
	}
	if N == 1 {
		return ZRR, ZRI, FNU, N, YR, YI, NZ, RZR, RZI, ASCLE, TOL, ELIM
	}
	if IC > 1 {
		goto Twenty
	}
	YR[1] = ZEROR
	YI[1] = ZEROI
	NZ = 2
Twenty:
	if N == 2 {
		return ZRR, ZRI, FNU, N, YR, YI, NZ, RZR, RZI, ASCLE, TOL, ELIM
	}
	if NZ == 0 {
		return ZRR, ZRI, FNU, N, YR, YI, NZ, RZR, RZI, ASCLE, TOL, ELIM
	}
	FN = FNU + 1.0e0
	CKR = FN * RZR
	CKI = FN * RZI
	S1R = CYR[1]
	S1I = CYI[1]
	S2R = CYR[2]
	S2I = CYI[2]
	HELIM = 0.5e0 * ELIM
	ELM = math.Exp(-ELIM)
	CELMR = ELM
	ZDR = ZRR
	ZDI = ZRI

	// FIND TWO CONSECUTIVE Y VALUES ON SCALE. SCALE RECURRENCE IF
	// S2 GETS LARGER THAN EXP(ELIM/2)
	for I = 3; I <= N; I++ {
		KK = I
		CSR = S2R
		CSI = S2I
		S2R = CKR*CSR - CKI*CSI + S1R
		S2I = CKI*CSR + CKR*CSI + S1I
		S1R = CSR
		S1I = CSI
		CKR = CKR + RZR
		CKI = CKI + RZI
		AS = cmplx.Abs(complex(S2R, S2I))
		ALAS = math.Log(AS)
		ACS = -ZDR + ALAS
		NZ = NZ + 1
		YR[I] = ZEROR
		YI[I] = ZEROI
		if ACS < (-ELIM) {
			goto TwentyFive
		}
		tmp = cmplx.Log(complex(S2R, S2I))
		CSR = real(tmp)
		CSI = imag(tmp)
		CSR = CSR - ZDR
		CSI = CSI - ZDI
		STR = math.Exp(CSR) / TOL
		sin, cos = math.Sincos(CSI)
		CSR = STR * cos
		CSI = STR * sin
		c = complex(CSR, CSI)
		NW = Zuchk(c, ASCLE, TOL)
		if NW != 0 {
			goto TwentyFive
		}
		YR[I] = CSR
		YI[I] = CSI
		NZ = NZ - 1
		if IC == KK-1 {
			goto Forty
		}
		IC = KK
		continue
	TwentyFive:
		if ALAS < HELIM {
			continue
		}
		ZDR = ZDR - ELIM
		S1R = S1R * CELMR
		S1I = S1I * CELMR
		S2R = S2R * CELMR
		S2I = S2I * CELMR
	}
	NZ = N
	if IC == N {
		NZ = N - 1
	}
	goto FourtyFive
Forty:
	NZ = KK - 2
FourtyFive:
	for I = 1; I <= NZ; I++ {
		YR[I] = ZEROR
		YI[I] = ZEROI
	}
	return ZRR, ZRI, FNU, N, YR, YI, NZ, RZR, RZI, ASCLE, TOL, ELIM
}

// Zuchk tests whether the magnitude of the real or imaginary part would
// underflow when y is scaled by tol.
//
// y enters as a scaled quantity whose magnitude is greater than
//
//	1e3 + 3*dmach(1)/tol
//
// y is accepted if the underflow is at least one precision below the magnitude
// of the largest component. Otherwise an underflow is assumed as the phase angle
// does not have sufficient accuracy.
func Zuchk(y complex128, scale, tol float64) int {
	absR := math.Abs(real(y))
	absI := math.Abs(imag(y))
	minAbs := math.Min(absR, absI)
	if minAbs > scale {
		return 0
	}
	maxAbs := math.Max(absR, absI)
	minAbs /= tol
	if maxAbs < minAbs {
		return 1
	}
	return 0
}

// ZACAI APPLIES THE ANALYTIC CONTINUATION FORMULA
//
//	K(FNU,ZN*EXP(MP))=K(FNU,ZN)*EXP(-MP*FNU) - MP*I(FNU,ZN)
//	      MP=PI*MR*CMPLX(0.0,1.0)
//
// TO CONTINUE THE K FUNCTION FROM THE RIGHT HALF TO THE LEFT
// HALF Z PLANE FOR USE WITH ZAIRY WHERE FNU=1/3 OR 2/3 AND N=1.
// ZACAI IS THE SAME AS ZACON WITH THE PARTS FOR LARGER ORDERS AND
// RECURRENCE REMOVED. A RECURSIVE CALL TO ZACON CAN RESULT if ZACON
// IS CALLED FROM ZAIRY.
func Zacai(ZR, ZI, FNU float64, KODE, MR, N int, YR, YI []float64, RL, TOL, ELIM, ALIM float64) (
	ZRout, ZIout, FNUout float64, KODEout, MRout, Nout int, YRout, YIout []float64, NZ int, RLout, TOLout, ELIMout, ALIMout float64) {
	var ARG, ASCLE, AZ, CSGNR, CSGNI, CSPNR,
		CSPNI, C1R, C1I, C2R, C2I, DFNU, FMR, PI,
		SGN, YY, ZNR, ZNI float64
	var INU, IUF, NN, NW int
	var zn, c1, c2, z complex128
	var y []complex128
	//var sin, cos float64

	CYR := []float64{math.NaN(), 0, 0}
	CYI := []float64{math.NaN(), 0, 0}

	PI = math.Pi
	ZNR = -ZR
	ZNI = -ZI
	AZ = cmplx.Abs(complex(ZR, ZI))
	NN = N
	DFNU = FNU + float64(float32(N-1))
	if AZ <= 2.0e0 {
		goto Ten
	}
	if AZ*AZ*0.25 > DFNU+1.0e0 {
		goto Twenty
	}
Ten:
	// POWER SERIES FOR THE I FUNCTION.
	z = complex(ZNR, ZNI)
	y = make([]complex128, len(YR))
	for i, v := range YR {
		y[i] = complex(v, YI[i])
	}
	Zseri(z, FNU, KODE, NN, y[1:], TOL, ELIM, ALIM)
	for i, v := range y {
		YR[i] = real(v)
		YI[i] = imag(v)
	}
	goto Forty
Twenty:
	if AZ < RL {
		goto Thirty
	}
	// ASYMPTOTIC EXPANSION FOR LARGE Z FOR THE I FUNCTION.
	ZNR, ZNI, FNU, KODE, _, YR, YI, NW, RL, TOL, ELIM, ALIM = Zasyi(ZNR, ZNI, FNU, KODE, NN, YR, YI, RL, TOL, ELIM, ALIM)
	if NW < 0 {
		goto Eighty
	}
	goto Forty
Thirty:
	// MILLER ALGORITHM NORMALIZED BY THE SERIES FOR THE I FUNCTION
	ZNR, ZNI, FNU, KODE, _, YR, YI, NW, TOL = Zmlri(ZNR, ZNI, FNU, KODE, NN, YR, YI, TOL)
	if NW < 0 {
		goto Eighty
	}
Forty:
	// ANALYTIC CONTINUATION TO THE LEFT HALF PLANE FOR THE K FUNCTION.
	ZNR, ZNI, FNU, KODE, _, CYR, CYI, NW, TOL, ELIM, ALIM = Zbknu(ZNR, ZNI, FNU, KODE, 1, CYR, CYI, TOL, ELIM, ALIM)
	if NW != 0 {
		goto Eighty
	}
	FMR = float64(float32(MR))
	SGN = -math.Copysign(PI, FMR)
	CSGNR = 0.0e0
	CSGNI = SGN
	if KODE == 1 {
		goto Fifty
	}
	YY = -ZNI
	//sin, cos = math.Sincos(YY)
	CSGNR = -CSGNI * math.Sin(YY)
	CSGNI = CSGNI * math.Cos(YY)
Fifty:
	// CALCULATE CSPN=EXP(FNU*PI*I) TO MINIMIZE LOSSES OF SIGNIFICANCE
	// WHEN FNU IS LARGE
	INU = int(float32(FNU))
	ARG = (FNU - float64(float32(INU))) * SGN
	//sin, cos = math.Sincos(ARG)
	CSPNR = math.Cos(ARG)
	CSPNI = math.Sin(ARG)
	if INU%2 == 0 {
		goto Sixty
	}
	CSPNR = -CSPNR
	CSPNI = -CSPNI
Sixty:
	C1R = CYR[1]
	C1I = CYI[1]
	C2R = YR[1]
	C2I = YI[1]
	if KODE == 1 {
		goto Seventy
	}
	IUF = 0
	ASCLE = 1.0e+3 * dmach[1] / TOL
	zn = complex(ZNR, ZNI)
	c1 = complex(C1R, C1I)
	c2 = complex(C2R, C2I)
	c1, c2, NW, _ = Zs1s2(zn, c1, c2, ASCLE, ALIM, IUF)
	C1R = real(c1)
	C1I = imag(c1)
	C2R = real(c2)
	C2I = imag(c2)
	NZ = NZ + NW
Seventy:
	YR[1] = CSPNR*C1R - CSPNI*C1I + CSGNR*C2R - CSGNI*C2I
	YI[1] = CSPNR*C1I + CSPNI*C1R + CSGNR*C2I + CSGNI*C2R
	return ZR, ZI, FNU, KODE, MR, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
Eighty:
	NZ = -1
	if NW == -2 {
		NZ = -2
	}
	return ZR, ZI, FNU, KODE, MR, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
}

// ZASYI COMPUTES THE I BESSEL FUNCTION FOR REAL(Z)>=0.0 BY
// MEANS OF THE ASYMPTOTIC EXPANSION FOR LARGE CABS(Z) IN THE
// REGION CABS(Z)>MAX(RL,FNU*FNU/2). NZ=0 IS A NORMAL return.
// NZ<0 INDICATES AN OVERFLOW ON KODE=1.
func Zasyi(ZR, ZI, FNU float64, KODE, N int, YR, YI []float64, RL, TOL, ELIM, ALIM float64) (
	ZRout, ZIout, FNUout float64, KODEout, Nout int, YRout, YIout []float64, NZ int, RLout, TOLout, ELIMout, ALIMout float64) {
	var AA, AEZ, AK, AK1I, AK1R, ARG, ARM, ATOL,
		AZ, BB, BK, CKI, CKR, CONEI, CONER, CS1I, CS1R, CS2I, CS2R, CZI,
		CZR, DFNU, DKI, DKR, DNU2, EZI, EZR, FDN, PI, P1I,
		P1R, RAZ, RTPI, RTR1, RZI, RZR, S, SGN, SQK, STI, STR, S2I,
		S2R, TZI, TZR, ZEROI, ZEROR float64

	var I, IB, IL, INU, J, JL, K, KODED, M, NN int
	var tmp complex128
	// var sin, cos float64

	PI = math.Pi
	RTPI = 0.159154943091895336e0
	ZEROR = 0
	ZEROI = 0
	CONER = 1
	CONEI = 0

	AZ = cmplx.Abs(complex(ZR, ZI))
	ARM = 1.0e3 * dmach[1]
	RTR1 = math.Sqrt(ARM)
	IL = min(2, N)
	DFNU = FNU + float64(float32(N-IL))

	// OVERFLOW TEST
	RAZ = 1.0e0 / AZ
	STR = ZR * RAZ
	STI = -ZI * RAZ
	AK1R = RTPI * STR * RAZ
	AK1I = RTPI * STI * RAZ
	tmp = cmplx.Sqrt(complex(AK1R, AK1I))
	AK1R = real(tmp)
	AK1I = imag(tmp)
	CZR = ZR
	CZI = ZI
	if KODE != 2 {
		goto Ten
	}
	CZR = ZEROR
	CZI = ZI
Ten:
	if math.Abs(CZR) > ELIM {
		goto OneHundred
	}
	DNU2 = DFNU + DFNU
	KODED = 1
	if (math.Abs(CZR) > ALIM) && (N > 2) {
		goto Twenty
	}
	KODED = 0
	tmp = cmplx.Exp(complex(CZR, CZI))
	STR = real(tmp)
	STI = imag(tmp)
	tmp = complex(AK1R, AK1I) * complex(STR, STI)
	AK1R = real(tmp)
	AK1I = imag(tmp)
Twenty:
	FDN = 0.0e0
	if DNU2 > RTR1 {
		FDN = DNU2 * DNU2
	}
	EZR = ZR * 8.0e0
	EZI = ZI * 8.0e0

	// WHEN Z IS IMAGINARY, THE ERROR TEST MUST BE MADE RELATIVE TO THE
	// FIRST RECIPROCAL POWER SINCE THIS IS THE LEADING TERM OF THE
	// EXPANSION FOR THE IMAGINARY PART.
	AEZ = 8.0e0 * AZ
	S = TOL / AEZ
	JL = int(float32(RL+RL)) + 2
	P1R = ZEROR
	P1I = ZEROI
	if ZI == 0.0e0 {
		goto Thirty
	}

	// CALCULATE EXP(PI*(0.5+FNU+N-IL)*I) TO MINIMIZE LOSSES OF
	// SIGNIFICANCE WHEN FNU OR N IS LARGE
	INU = int(float32(FNU))
	ARG = (FNU - float64(float32(INU))) * PI
	INU = INU + N - IL
	//sin, cos = math.Sincos(ARG)
	AK = -math.Sin(ARG)
	BK = math.Cos(ARG)
	if ZI < 0.0e0 {
		BK = -BK
	}
	P1R = AK
	P1I = BK
	if INU%2 == 0 {
		goto Thirty
	}
	P1R = -P1R
	P1I = -P1I
Thirty:
	for K = 1; K <= IL; K++ {
		SQK = FDN - 1.0e0
		ATOL = S * math.Abs(SQK)
		SGN = 1.0e0
		CS1R = CONER
		CS1I = CONEI
		CS2R = CONER
		CS2I = CONEI
		CKR = CONER
		CKI = CONEI
		AK = 0.0e0
		AA = 1.0e0
		BB = AEZ
		DKR = EZR
		DKI = EZI
		// TODO(btracey): This loop is executed tens of thousands of times. Why?
		// is that really necessary?
		for J = 1; J <= JL; J++ {
			tmp = complex(CKR, CKI) / complex(DKR, DKI)
			STR = real(tmp)
			STI = imag(tmp)
			CKR = STR * SQK
			CKI = STI * SQK
			CS2R = CS2R + CKR
			CS2I = CS2I + CKI
			SGN = -SGN
			CS1R = CS1R + CKR*SGN
			CS1I = CS1I + CKI*SGN
			DKR = DKR + EZR
			DKI = DKI + EZI
			AA = AA * math.Abs(SQK) / BB
			BB = BB + AEZ
			AK = AK + 8.0e0
			SQK = SQK - AK
			if AA <= ATOL {
				goto Fifty
			}
		}
		goto OneTen
	Fifty:
		S2R = CS1R
		S2I = CS1I
		if ZR+ZR >= ELIM {
			goto Sixty
		}
		TZR = ZR + ZR
		TZI = ZI + ZI
		tmp = cmplx.Exp(complex(-TZR, -TZI))
		STR = real(tmp)
		STI = imag(tmp)
		tmp = complex(STR, STI) * complex(P1R, P1I)
		STR = real(tmp)
		STI = imag(tmp)
		tmp = complex(STR, STI) * complex(CS2R, CS2I)
		STR = real(tmp)
		STI = imag(tmp)
		S2R = S2R + STR
		S2I = S2I + STI
	Sixty:
		FDN = FDN + 8.0e0*DFNU + 4.0e0
		P1R = -P1R
		P1I = -P1I
		M = N - IL + K
		YR[M] = S2R*AK1R - S2I*AK1I
		YI[M] = S2R*AK1I + S2I*AK1R
	}
	if N <= 2 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
	}
	NN = N
	K = NN - 2
	AK = float64(float32(K))
	STR = ZR * RAZ
	STI = -ZI * RAZ
	RZR = (STR + STR) * RAZ
	RZI = (STI + STI) * RAZ
	IB = 3
	for I = IB; I <= NN; I++ {
		YR[K] = (AK+FNU)*(RZR*YR[K+1]-RZI*YI[K+1]) + YR[K+2]
		YI[K] = (AK+FNU)*(RZR*YI[K+1]+RZI*YR[K+1]) + YI[K+2]
		AK = AK - 1.0e0
		K = K - 1
	}
	if KODED == 0 {
		return ZR, ZI, FNU, KODE, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
	}
	tmp = cmplx.Exp(complex(CZR, CZI))
	CKR = real(tmp)
	CKI = imag(tmp)
	for I = 1; I <= NN; I++ {
		STR = YR[I]*CKR - YI[I]*CKI
		YI[I] = YR[I]*CKI + YI[I]*CKR
		YR[I] = STR
	}
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
OneHundred:
	NZ = -1
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
OneTen:
	NZ = -2
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, RL, TOL, ELIM, ALIM
}

// ZMLRI COMPUTES THE I BESSEL FUNCTION FOR RE(Z)>=0.0 BY THE
// MILLER ALGORITHM NORMALIZED BY A NEUMANN SERIES.
func Zmlri(ZR, ZI, FNU float64, KODE, N int, YR, YI []float64, TOL float64) (
	ZRout, ZIout, FNUout float64, KODEout, Nout int, YRout, YIout []float64, NZ int, TOLout float64) {
	var ACK, AK, AP, AT, AZ, BK, CKI, CKR, CNORMI,
		CNORMR, CONEI, CONER, FKAP, FKK, FLAM, FNF, PTI, PTR, P1I,
		P1R, P2I, P2R, RAZ, RHO, RHO2, RZI, RZR, SCLE, STI, STR, SUMI,
		SUMR, TFNF, TST, ZEROI, ZEROR float64
	var I, IAZ, IDUM, IFNU, INU, ITIME, K, KK, KM, M int
	var tmp complex128
	ZEROR = 0
	ZEROI = 0
	CONER = 1
	CONEI = 0

	SCLE = dmach[1] / TOL
	AZ = cmplx.Abs(complex(ZR, ZI))
	IAZ = int(float32(AZ))
	IFNU = int(float32(FNU))
	INU = IFNU + N - 1
	AT = float64(float32(IAZ)) + 1.0e0
	RAZ = 1.0e0 / AZ
	STR = ZR * RAZ
	STI = -ZI * RAZ
	CKR = STR * AT * RAZ
	CKI = STI * AT * RAZ
	RZR = (STR + STR) * RAZ
	RZI = (STI + STI) * RAZ
	P1R = ZEROR
	P1I = ZEROI
	P2R = CONER
	P2I = CONEI
	ACK = (AT + 1.0e0) * RAZ
	RHO = ACK + math.Sqrt(ACK*ACK-1.0e0)
	RHO2 = RHO * RHO
	TST = (RHO2 + RHO2) / ((RHO2 - 1.0e0) * (RHO - 1.0e0))
	TST = TST / TOL

	// COMPUTE RELATIVE TRUNCATION ERROR INDEX FOR SERIES.
	//fmt.Println("before loop", P2R, P2I, CKR, CKI, RZR, RZI, TST, AK)
	AK = AT
	for I = 1; I <= 80; I++ {
		PTR = P2R
		PTI = P2I
		P2R = P1R - (CKR*PTR - CKI*PTI)
		P2I = P1I - (CKI*PTR + CKR*PTI)
		P1R = PTR
		P1I = PTI
		CKR = CKR + RZR
		CKI = CKI + RZI
		AP = cmplx.Abs(complex(P2R, P2I))
		if AP > TST*AK*AK {
			goto Twenty
		}
		AK = AK + 1.0e0
	}
	goto OneTen
Twenty:
	I = I + 1
	K = 0
	if INU < IAZ {
		goto Forty
	}
	// COMPUTE RELATIVE TRUNCATION ERROR FOR RATIOS.
	P1R = ZEROR
	P1I = ZEROI
	P2R = CONER
	P2I = CONEI
	AT = float64(float32(INU)) + 1.0e0
	STR = ZR * RAZ
	STI = -ZI * RAZ
	CKR = STR * AT * RAZ
	CKI = STI * AT * RAZ
	ACK = AT * RAZ
	TST = math.Sqrt(ACK / TOL)
	ITIME = 1
	for K = 1; K <= 80; K++ {
		PTR = P2R
		PTI = P2I
		P2R = P1R - (CKR*PTR - CKI*PTI)
		P2I = P1I - (CKR*PTI + CKI*PTR)
		P1R = PTR
		P1I = PTI
		CKR = CKR + RZR
		CKI = CKI + RZI
		AP = cmplx.Abs(complex(P2R, P2I))
		if AP < TST {
			continue
		}
		if ITIME == 2 {
			goto Forty
		}
		ACK = cmplx.Abs(complex(CKR, CKI))
		FLAM = ACK + math.Sqrt(ACK*ACK-1.0e0)
		FKAP = AP / cmplx.Abs(complex(P1R, P1I))
		RHO = math.Min(FLAM, FKAP)
		TST = TST * math.Sqrt(RHO/(RHO*RHO-1.0e0))
		ITIME = 2
	}
	goto OneTen
Forty:
	// BACKWARD RECURRENCE AND SUM NORMALIZING RELATION.
	K = K + 1
	KK = max(I+IAZ, K+INU)
	FKK = float64(float32(KK))
	P1R = ZEROR
	P1I = ZEROI

	// SCALE P2 AND SUM BY SCLE.
	P2R = SCLE
	P2I = ZEROI
	FNF = FNU - float64(float32(IFNU))
	TFNF = FNF + FNF
	BK = dgamln(FKK+TFNF+1.0e0, IDUM) - dgamln(FKK+1.0e0, IDUM) - dgamln(TFNF+1.0e0, IDUM)
	BK = math.Exp(BK)
	SUMR = ZEROR
	SUMI = ZEROI
	KM = KK - INU
	for I = 1; I <= KM; I++ {
		PTR = P2R
		PTI = P2I
		P2R = P1R + (FKK+FNF)*(RZR*PTR-RZI*PTI)
		P2I = P1I + (FKK+FNF)*(RZI*PTR+RZR*PTI)
		P1R = PTR
		P1I = PTI
		AK = 1.0e0 - TFNF/(FKK+TFNF)
		ACK = BK * AK
		SUMR = SUMR + (ACK+BK)*P1R
		SUMI = SUMI + (ACK+BK)*P1I
		BK = ACK
		FKK = FKK - 1.0e0
	}
	YR[N] = P2R
	YI[N] = P2I
	if N == 1 {
		goto Seventy
	}
	for I = 2; I <= N; I++ {
		PTR = P2R
		PTI = P2I
		P2R = P1R + (FKK+FNF)*(RZR*PTR-RZI*PTI)
		P2I = P1I + (FKK+FNF)*(RZI*PTR+RZR*PTI)
		P1R = PTR
		P1I = PTI
		AK = 1.0e0 - TFNF/(FKK+TFNF)
		ACK = BK * AK
		SUMR = SUMR + (ACK+BK)*P1R
		SUMI = SUMI + (ACK+BK)*P1I
		BK = ACK
		FKK = FKK - 1.0e0
		M = N - I + 1
		YR[M] = P2R
		YI[M] = P2I
	}
Seventy:
	if IFNU <= 0 {
		goto Ninety
	}
	for I = 1; I <= IFNU; I++ {
		PTR = P2R
		PTI = P2I
		P2R = P1R + (FKK+FNF)*(RZR*PTR-RZI*PTI)
		P2I = P1I + (FKK+FNF)*(RZR*PTI+RZI*PTR)
		P1R = PTR
		P1I = PTI
		AK = 1.0e0 - TFNF/(FKK+TFNF)
		ACK = BK * AK
		SUMR = SUMR + (ACK+BK)*P1R
		SUMI = SUMI + (ACK+BK)*P1I
		BK = ACK
		FKK = FKK - 1.0e0
	}
Ninety:
	PTR = ZR
	PTI = ZI
	if KODE == 2 {
		PTR = ZEROR
	}
	tmp = cmplx.Log(complex(RZR, RZI))
	STR = real(tmp)
	STI = imag(tmp)
	P1R = -FNF*STR + PTR
	P1I = -FNF*STI + PTI
	AP = dgamln(1.0e0+FNF, IDUM)
	PTR = P1R - AP
	PTI = P1I

	// THE DIVISION CEXP(PT)/(SUM+P2) IS ALTERED TO AVOID OVERFLOW
	// IN THE DENOMINATOR BY SQUARING LARGE QUANTITIES.
	P2R = P2R + SUMR
	P2I = P2I + SUMI
	AP = cmplx.Abs(complex(P2R, P2I))
	P1R = 1.0e0 / AP
	tmp = cmplx.Exp(complex(PTR, PTI))
	STR = real(tmp)
	STI = imag(tmp)
	CKR = STR * P1R
	CKI = STI * P1R
	PTR = P2R * P1R
	PTI = -P2I * P1R
	tmp = complex(CKR, CKI) * complex(PTR, PTI)
	CNORMR = real(tmp)
	CNORMI = imag(tmp)
	for I = 1; I <= N; I++ {
		STR = YR[I]*CNORMR - YI[I]*CNORMI
		YI[I] = YR[I]*CNORMI + YI[I]*CNORMR
		YR[I] = STR
	}
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL
OneTen:
	NZ = -2
	return ZR, ZI, FNU, KODE, N, YR, YI, NZ, TOL
}

// Zseri computes the I bessel function for real(z) >= 0 by means of the power
// series for large |z| in the region |z| <= 2*sqrt(fnu+1).
//
// nz = 0 is a normal return. nz > 0 means that the last nz components were set
// to zero due to underflow. nz < 0 means that underflow occurred, but the
// condition |z| <= 2*sqrt(fnu+1) was violated and the computation must be
// completed in another routine with n -= abs(nz).
func Zseri(z complex128, fnu float64, kode, n int, y []complex128, tol, elim, alim float64) (nz int) {
	// TODO(btracey): The original fortran line is "ARM = 1.0D+3*D1MACH(1)". Evidently, in Fortran
	// this is interpreted as one to the power of +3*D1MACH(1). While it is possible
	// this was intentional, it seems unlikely.
	arm := 1000 * dmach[1]
	az := cmplx.Abs(z)
	if az < arm {
		for i := 0; i < n; i++ {
			y[i] = 0
		}
		if fnu == 0 {
			y[0] = 1
			n--
		}
		if az == 0 {
			return 0
		}
		return n
	}
	hz := 0.5 * z
	var cz complex128
	var acz float64
	if az > math.Sqrt(arm) {
		cz = hz * hz
		acz = cmplx.Abs(cz)
	}
	NN := n
	ck := cmplx.Log(hz)
	var ak1 complex128
	for {
		dfnu := fnu + float64(NN-1)
		// Underflow test.
		ak1 = ck * complex(dfnu, 0)
		ak := dgamln(dfnu+1, 0)
		ak1 -= complex(ak, 0)
		if kode == 2 {
			ak1 -= complex(real(z), 0)
		}
		if real(ak1) > -elim {
			break
		}
		nz++
		y[NN-1] = 0
		if acz > dfnu {
			// Return with nz < 0 if abs(Z*Z/4)>fnu+u-nz-1 complete the calculation
			// in cbinu with n = n - abs(nz).
			nz *= -1
			return nz
		}
		NN--
		if NN == 0 {
			return nz
		}
	}
	crscr := 1.0
	var flag int
	var scale float64
	aa := real(ak1)
	if aa <= -alim {
		flag = 1
		crscr = tol
		scale = arm / tol
		aa -= math.Log(tol)
	}
	var w [2]complex128
	for {
		coef := cmplx.Exp(complex(aa, imag(ak1)))
		atol := tol * acz / (fnu + float64(NN))
		for i := 0; i < min(2, NN); i++ {
			FNUP := fnu + float64(NN-i)
			s1 := 1 + 0i
			if acz >= tol*FNUP {
				ak2 := 1 + 0i
				ak := FNUP + 2
				S := FNUP
				scl := 2.0
				first := true
				for first || scl > atol {
					ak2 = ak2 * cz * complex(1/S, 0)
					scl *= acz / S
					s1 += ak2
					S += ak
					ak += 2
					first = false
				}
			}
			s2 := s1 * coef
			w[i] = s2
			if flag == 1 {
				if Zuchk(s2, scale, tol) != 0 {
					var full bool
					var dfnu float64
					// This code is similar to the code that exists above. The
					// code copying is here because the original Fortran used
					// a goto to solve the loop-and-a-half problem. Removing the
					// goto makes the behavior of the function and variable scoping
					// much clearer, but requires copying this code due to Go's
					// goto rules.
					for {
						if full {
							dfnu = fnu + float64(NN-1)
							// Underflow test.
							ak1 = ck * complex(dfnu, 0)
							ak1 -= complex(dgamln(dfnu+1, 0), 0)
							if kode == 2 {
								ak1 -= complex(real(z), 0)
							}
							if real(ak1) > -elim {
								break
							}
						} else {
							full = true
						}
						nz++
						y[NN-1] = 0
						if acz > dfnu {
							// Return with nz < 0 if abs(Z*Z/4)>fnu+u-nz-1 complete the calculation
							// in cbinu with n = n - abs(nz).
							nz *= -1
							return nz
						}
						NN--
						if NN == 0 {
							return nz
						}
					}
					continue
				}
			}
			y[NN-i-1] = s2 * complex(crscr, 0)
			coef /= hz
			coef *= complex(FNUP-1, 0)
		}
		break
	}
	if NN <= 2 {
		return nz
	}
	rz := complex(2*real(z)/(az*az), -2*imag(z)/(az*az))
	if flag == 0 {
		for i := NN - 3; i >= 0; i-- {
			y[i] = complex(float64(i+1)+fnu, 0)*rz*y[i+1] + y[i+2]
		}
		return nz
	}

	// exp(-alim)=exp(-elim)/tol=approximately one digit of precision above the
	// underflow limit, which equals scale = dmach[1)*SS*1e3.
	s1 := w[0]
	s2 := w[1]
	for K := NN - 3; K >= 0; K-- {
		s1, s2 = s2, s1+complex(float64(K+1)+fnu, 0)*(rz*s2)
		ck := s2 * complex(crscr, 0)
		y[K] = ck
		if cmplx.Abs(ck) > scale {
			for ; K >= 0; K-- {
				y[K] = complex(float64(K+1)+fnu, 0)*rz*y[K+1] + y[K+2]
			}
			return nz
		}
	}
	return nz
}

// Zs1s2 tests for a possible underflow resulting from the addition of the I and
// K functions in the analytic continuation formula where s1 == K function and
// s2 == I function.
//
// When kode == 1, the I and K functions are different orders of magnitude.
//
// When kode == 2, they may both be of the same order of magnitude, but the maximum
// must be at least one precision above the underflow limit.
func Zs1s2(zr, s1, s2 complex128, scale, lim float64, iuf int) (s1o, s2o complex128, nz, iufo int) {
	if s1 == 0 || math.Log(cmplx.Abs(s1))-2*real(zr) < -lim {
		if cmplx.Abs(s2) > scale {
			return 0, s2, 0, iuf
		}
		return 0, 0, 1, 0
	}
	// TODO(btracey): Written like this for numerical rounding reasons.
	// Fix once we're sure other changes are correct.
	s1 = cmplx.Exp(cmplx.Log(s1) - zr - zr)
	if math.Max(cmplx.Abs(s1), cmplx.Abs(s2)) > scale {
		return s1, s2, 0, iuf + 1
	}
	return 0, 0, 1, 0
}

func dgamln(z float64, ierr int) float64 {
	//return amoslib.DgamlnFort(z)
	// Go implementation.
	if z < 0 {
		return 0
	}
	a2, _ := math.Lgamma(z)
	return a2
}
